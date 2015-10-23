var exToJSON = Backbone.Model.prototype.toJSON;

var allAssociations = function () {
	var allAssociations = {};

	var ctor = this;
	do { 
		_.extend(allAssociations, ctor._associations);
		ctor = ctor.parent;
	} while (ctor);

	return allAssociations;
};

var toJSON = function (options) {	
	if (this instanceof Backbone.Model) {
		return toJSONModel.call(this, options);
	} else if (this instanceof Backbone.Collection) {
		return toJSONCollection.call(this, options);
	}
};

var toJSONModel = function (options) {
	if (_.isFunction(options.assoc)) {
		options.pick = [];
		_.each(this.attributes, function (value, key) {			
			if (options.assoc(options.assocName, value, key, this)) {
				options.pick.push(key);
			}
		}, this);
	}

	return this.toJSON(options);
};

var toJSONCollection = function (options) {	
	var output = [];
	this.each(function (model) {
		output.push(toJSONModel.call(model, options));
	}, this);

	return output;
};

var getAssocConfig = function (assocName, assocOption) {
	var assocConfig = {};

	if (_.isObject(assocOption) &&
		!_.isFunction(assocOption)) {
		// Config as an object.

		var defaultAssocOptions = assocOption['*'];

		// The configuration for the assoc is false.
		if (_.isBoolean(defaultAssocOptions) && defaultAssocOptions) {
			defaultAssocOptions = {
				pick: true
			};
		}

		assocConfig = assocOption[assocName];

		// The configuration for the assoc is false.
		if (_.isBoolean(assocConfig) &&
			!assocConfig) {
			return false;
		}

		// There is not configuration available
		// for the assoc, but default one.
		if (_.isObject(assocOption) &&
			!_.isFunction(assocOption) &&
			_.isObject(defaultAssocOptions) &&
			!assocConfig) {
			assocConfig = defaultAssocOptions;
		}

		// There is not configuration available for the assoc (neither default nor assoc).
		if (_.isObject(assocOption) &&
			!_.isFunction(assocOption) &&
			_.isBoolean(defaultAssocOptions) &&
			!defaultAssocOptions &&
			!assocConfig) {
			return false;
		}

		// There is not any configuration for the assoc.
		if (_.isObject(assocOption) &&
			!_.isFunction(assocOption) &&
			_.isUndefined(defaultAssocOptions) && 
			!assocConfig) {
			return false;
		}

	} else if (_.isFunction(assocOption)) {
		// Config as an function. 
		assocConfig.assoc = assocOption;
	}

	return assocConfig;
};

Supermodel.Model.prototype.toJSON = _.wrap(exToJSON, 
	function (exToJSON) {
		var options = arguments[1];

		options || (options = {});

		// Jsonify model
		var output = exToJSON.call(this, options);

		// Include cid?
		if (!options.cid) {
			delete output[this.cidAttribute];
		}

		var assocOption = options.assoc;
		// Jsonify assocs?
		if ((_.isObject(assocOption) || _.isBoolean(assocOption) || _.isFunction(assocOption)) &&
			assocOption) {
			// the assoc config is an object, function or boolean.

			var defaultAssocOptions;
			// Config as an object. Get default config for each association.
			if (_.isObject(assocOption) &&
				!_.isFunction(assocOption)) {
				defaultAssocOptions = assocOption['*'];
			}

			// Config as an object. Only "*" is set and false.
			if (_.isObject(assocOption)  &&
				!_.isFunction(assocOption) &&
				_.keys(assocOption).length === 1 &&
				_.isBoolean(defaultAssocOptions) &&
				!defaultAssocOptions) {
				return output;
			}

			// Prepares an object of assocs with assocName as key 
			// and assocStore as value.
			var allAssoc = allAssociations.call(this.constructor);
			allAssoc = _.mapObject(allAssoc, function (assoc) {
				return this[assoc.name]();
			}, this);

			// Iterates over associations.
			for (var assocName in allAssoc) {
				if (allAssoc.hasOwnProperty(assocName)) {
					var assocStore = allAssoc[assocName];

					var assocConfig = getAssocConfig(assocName, assocOption);

					// There is not a valid config for the assoc. Skip current assoc jsonify.
					if (!assocConfig) {
						continue;
					}

					var newAssocConfig = _.extend({}, options, {
						assoc: undefined, // Cleans assoc option.
						pick: undefined, // Cleans pick option.
						omit: undefined // Cleans omit option.
					}, assocConfig);

					// Jsonify deep mode.
					if (options.deepAssoc) {
						var avoidLoop = _.union([], options.avoidLoop);

						// Check if prevent loop.
						if (!assocOption.assoc || 
							(assocOption.assoc && !assocOption.assoc[assocName])) { // There is not an assoc config.
							if (assocStore instanceof Backbone.Model) {
								if (_.indexOf(avoidLoop, assocStore) >= 0) {
									continue;
								}
							} else if (assocStore instanceof Backbone.Collection) {
								if (_.indexOf(avoidLoop, assocStore.owner) >= 0) {
									continue;
								}
							}
						}

						// Builds the option for excluding models already jsonified.
						avoidLoop = _.union(avoidLoop, _.values(allAssoc), [this]);

						// Prepares the option for the deep models.
						_.extend(newAssocConfig, {
							assoc: {
								"*": defaultAssocOptions // The default config for associations is spread.
							},
							deepAssoc: true,
							avoidLoop: avoidLoop 
						}, assocConfig);
					}

					if (_.isFunction(assocOption)) {
						if (!assocOption(assocName, undefined, undefined, assocStore)) {
							continue;
						}

						_.extend(newAssocConfig, {
							assocName: assocName
						});
					}

					// Jsonify assoc.
					output[assocName] = toJSON.call(assocStore, newAssocConfig);
				}
			}
		}

		return output;
	});