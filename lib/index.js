'use strict';

var Resource = require('./Resource'),
    Endpoint = require('./Endpoint'),
    Controllers = require('./Controllers'),
    inflection = require('inflection'),
    _ = require('lodash');

// make deep defaults the default
_.defaults = require('merge-defaults');

var epilogue = {
  initialize: function(args) {
    args = args || {};
    if (!args.app)
      throw new Error('please specify an app');
    if (!args.sequelize)
      throw new Error('please specify a sequelize instance');

    this.app = args.app;
    this.sequelize = args.sequelize;
    this.base = args.base || '';
    if (args.updateMethod) {
      var method = args.updateMethod.toLowerCase();
      if (!method.match(/^(put|post|patch)$/)) {
        throw new Error('updateMethod must be one of PUT, POST, or PATCH');
      }
      this.updateMethod = method;
    }
  },

  resource: function(options) {
    options = options || {};
    options = _.defaults(options, {
      include: [],
      associations: false
    });

    if (!options.model)
      throw new Error('please specify a valid model');

    if (!options.endpoints || !options.endpoints.length) {
      options.endpoints = [];
      var plural = inflection.pluralize(options.model.name);
      options.endpoints.push('/' + plural);
      options.endpoints.push('/' + plural + '/:id');
    }

    var endpoints = [];
    options.endpoints.forEach(function(e) {
      var endpoint = this.base + e;
      endpoints.push(endpoint);
    }.bind(this));

    var resource = new Resource({
      app: this.app,
      sequelize: this.sequelize,
      model: options.model,
      endpoints: endpoints,
      actions: options.actions,
      include: options.include,
      pagination: options.pagination,
      updateMethod: this.updateMethod,
      search: options.search,
      associations: options.associations
    });

    return resource;
  },

  Resource: Resource,
  Endpoint: Endpoint,
  Controllers: Controllers
};

module.exports = epilogue;
