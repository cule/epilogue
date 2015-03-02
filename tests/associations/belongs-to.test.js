'use strict';

var request = require('request'),
    expect = require('chai').expect,
    _ = require('lodash'),
    rest = require('../../lib'),
    test = require('../support'),
    Promise = test.Sequelize.Promise;

describe('Associations(BelongsTo)', function() {
  before(function() {
    test.models.User = test.db.define('users', {
      id: { type: test.Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      username: { type: test.Sequelize.STRING, unique: true },
      email: { type: test.Sequelize.STRING, unique: true, validate: { isEmail: true } }
    }, {
      underscored: true,
      timestamps: false
    });

    test.models.Address = test.db.define('addresses', {
      id: { type: test.Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      street: { type: test.Sequelize.STRING },
      state_province: { type: test.Sequelize.STRING },
      postal_code: { type: test.Sequelize.STRING },
      country_code: { type: test.Sequelize.STRING }
    }, {
      underscored: true,
      timestamps: false
    });

    test.models.Person = test.db.define('person', {
      id: { type: test.Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: test.Sequelize.STRING, unique: true }
    }, {
      underscored: true,
      timestamps: false
    });

    test.models.User.belongsTo(test.models.Address);  // user has an address_id
    test.models.Person.belongsTo(test.models.Address, {
      as: 'addy',
      foreignKey: 'addy_id'
    });
  });

  beforeEach(function(done) {
    test.initializeDatabase(function() {
      test.initializeServer(function() {
        rest.initialize({
          app: test.app,
          sequelize: test.Sequelize
        });

        rest.resource({
          model: test.models.User,
          endpoints: ['/users', '/users/:id'],
          associations: true
        });

        rest.resource({
          model: test.models.User,
          endpoints: ['/usersWithoutInclude', '/usersWithoutInclude/:id']
        });

        rest.resource({
          model: test.models.Person,
          endpoints: ['/people', '/people/:id'],
          associations: true
        });

        rest.resource({
          model: test.models.Address,
          endpoints: ['/addresses', '/addresses/:id']
        });

        done();
      });
    });
  });

  afterEach(function(done) {
    test.clearDatabase(function() {
      test.server.close(done);
    });
  });

  // TESTS
  describe('read', function() {
    beforeEach(function() {
      return Promise.all([
        test.models.Address.create({
          street: '221B Baker Street',
          state_province: 'London',
          postal_code: 'NW1',
          country_code: '44'
        }),
        test.models.User.create({
          username: 'sherlock',
          email: 'sherlock@holmes.com'
        }),
        test.models.Person.create({ name: 'barney' })
      ]).spread(function(address, user, person) {
        return Promise.all([
          user.setAddress(address),
          person.setAddy(address)
        ]);
      });
    });

    it('should include prefetched data', function(done) {
      request.get({
        url: test.baseUrl + '/users/1'
      }, function(error, response, body) {
        expect(response.statusCode).to.equal(200);
        var result = _.isObject(body) ? body : JSON.parse(body);
        var expected = {
          id: 1,
          username: 'sherlock',
          email: 'sherlock@holmes.com',
          address: {
            id: 1,
            street: '221B Baker Street',
            state_province: 'London',
            postal_code: 'NW1',
            country_code: '44'
          }
        };

        expect(result).to.eql(expected);
        done();
      });
    });

    it('should include prefetched data for an aliased relation', function(done) {
      request.get({
        url: test.baseUrl + '/people/1'
      }, function(error, response, body) {
        expect(response.statusCode).to.equal(200);
        var result = _.isObject(body) ? body : JSON.parse(body);
        var expected = {
          id: 1,
          name: 'barney',
          addy: {
            id: 1,
            street: '221B Baker Street',
            state_province: 'London',
            postal_code: 'NW1',
            country_code: '44'
          }
        };

        expect(result).to.eql(expected);
        done();
      });
    });

    it('should return associated data by url', function(done) {
      request.get({
        url: test.baseUrl + '/users/1/address'
      }, function(error, response, body) {
        console.log(body);

        expect(response.statusCode).to.equal(200);
        var result = _.isObject(body) ? body : JSON.parse(body);
        var expected = {
          id: 1,
          street: '221B Baker Street',
          state_province: 'London',
          postal_code: 'NW1',
          country_code: '44'
        };

        expect(result).to.eql(expected);
        done();
      });
    });

  });

  describe('list', function() {
    beforeEach(function() {
      test.expectedResult = [];
      var testData = [
        {
          user: { username: 'sherlock', email: 'sherlock@gmail.com' },
          address: { street: '221B Baker Street', state_province: 'London, UK', postal_code: 'NW1', country_code: '44'}
        },
        {
          user: { username: 'barack', email: 'barack@gmail.com' },
          address: { street: '1600 Pennsylvania Ave', state_province: 'Washington, DC', postal_code: '20500', country_code: '001'}
        },
        {
          user: { username: 'tony', email: 'tony@gmail.com' },
          address: { street: '633 Stag Trail RD', state_province: 'Caldwell, NJ', postal_code: '07006', country_code: '001'}
        },
        {
          user: { username: 'eddie', email: 'eddie@gmail.com' },
          address: { street: '1313 Mockingbird Ln', state_province: 'Lincoln, CA', postal_code: '95648', country_code: '001'}
        },
        {
          user: { username: 'lucy', email: 'lucy@gmail.com' },
          address: { street: '623 East 68th Street', state_province: 'New York, NY', postal_code: '10065', country_code: '001'}
        }
      ];

      var userCount = 0,
          addressCount = 0;
      testData.map(function(data) {
        return Promise.all([
          test.models.User.create(data.user),
          test.models.Address.create(data.address)
        ]).spread(function(user, address) {
          return user.setAddress(address);
        }).then(function() {
          userCount += 1;
          addressCount += 1;

          var record = data.user;
          record.id = userCount;
          record.address = data.address;
          record.address.id = addressCount;
          test.expectedResult.push(record);
        });
      });
    });

    afterEach(function() {
      delete test.expectedResults;
    });

    it('should include prefetched data', function(done) {
      request.get({
        url: test.baseUrl + '/users'
      }, function(error, response, body) {
        var result = _.isObject(body) ? body : JSON.parse(body);
        expect(result).to.eql(test.expectedResult);
        done();
      });
    });

    it('should pass query parameters to search', function(done) {
      request.get({
        url: test.baseUrl + '/usersWithoutInclude?address_id=1'
      }, function(error, response, body) {
        expect(response.statusCode).to.equal(200);
        var result = _.isObject(body) ? body : JSON.parse(body);
        expect(result.length).to.equal(1);

        var actual = result[0];
        var expected = {
          id: 1,
          username: 'sherlock',
          email: 'sherlock@gmail.com',
          address_id: 1
        };

        expect(actual).to.eql(expected);
        done();
      });
    });

  });

});
