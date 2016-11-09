exports.register = function(req, Device, Registration, callback){
	/*
	If the serial number is already registered for this device, returns HTTP status 200.
	*/
	Registration.find({
		deviceLibraryIdentifier : req.params['1'],
		passTypeIdentifier : req.params['2'],
		serialNumber : req.params['3']
	}, function(err, registrations){
		if(err){
			return callback(err, 500);
		}
		if(registrations.length === 1){
			return callback(null, 200);
		}
		/* 
		Store the mapping between the device library identifier 
		and the push token in the devices table.
		*/
		Device.update({
			deviceLibraryIdentifier : req.params['1']
		}, {
			deviceLibraryIdentifier : req.params['1'],
			pushToken : req.body.pushToken
		}, {
			upsert : true
		}, function(err){
			if(err){
				return callback(err, 500);
			}
			/*
			Store the mapping between the pass (by pass type identifier and serial number)
			and the device library identifier in the registrations table.
			*/
			var newRegistration = new Registration({
				deviceLibraryIdentifier : req.params['1'],
				passTypeIdentifier : req.params['2'],
				serialNumber : req.params['3']
			});
			newRegistration.save(function(err){
				if(err){
					return callback(err, 500);
				}
				return callback(null, 201);// If registration succeeds, returns HTTP status 201.
			});
		});
	});
};

exports.getSerialNumbers = function(req, Registration, Pass, callback){
	// If no update tag is provided, return all the passes that the device is registered for, hence 0. 
	var lastUpdated = (+req.query.passesUpdatedSince || 0);

	var responseBody = {
		serialNumbers : [],
		lastUpdated : ''
	};

	/*
	Look at the registrations table, and determine which passes the device is registered for.
	*/
	Registration.find({
		deviceLibraryIdentifier : req.params['1'],
		passTypeIdentifier : req.params['2']
	}, 'serialNumber', function(err, registrations){
		if(err){
			return callback(err, 500);
		}
		if(!registrations.length){
			// If there are no matching passes, returns HTTP status 204.
			return callback(new Error('No matching passes found in registration table'), 204);
		}
		var serialNumberList = registrations.map(function(registration){return registration.serialNumber});
		
		/*
		Look at the passes table, and determine which passes have changed since the given tag. 
		Don’t include serial numbers of passes that the device didn’t register for.
		*/
		Pass.find({
			serialNumber : {$in : serialNumberList},
			passTypeIdentifier : req.params['2']
		}, 'serialNumber lastUpdated', function(err, passes){
			if(err){
				return callback(err, 500);
			}
			if(!passes.length){
				return callback(new Error('No passes found matching the given serial number'), 204);
			}
			/*
			Compare the update tags for each pass that has changed and determine which one is the latest. 
			Return the latest update tag to the device.
			*/
			for(var i = 0; i < passes.length; i++){
				if(passes[i].lastUpdated > lastUpdated){
					responseBody.serialNumbers.push(passes[i].serialNumber);
					lastUpdated = passes[i].lastUpdated;// Find maximum
				}
			}
			responseBody.lastUpdated = lastUpdated.toString();
			// Respond with this list of serial numbers and the latest update tag in a JSON payload.
			return callback(null, 200, responseBody);
		});
	});
};

exports.getPass = function(req, Pass, callback){
	Pass.findOne({
		serialNumber : req.params['2'],
		passTypeIdentifier : req.params['1']
	}, function(err, pass){
		if(err){
			return callback(err, 500);
		}
		if(!pass){
			return callback(new Error('No passes found matching the given serial number'), 500);
		}
		// Server returns the pass data or the HTTP status 304 Not Modified if the pass hasn’t changed.
		if(pass.lastUpdated <= req.headers['if-modified-since']){
			return callback(null, 304);
		}
		return callback(null, 200, pass);
	});
};

exports.unregister = function(req, Registration, Device, callback){
	Registration.find({
		deviceLibraryIdentifier : req.params['1'],
		passTypeIdentifier : req.params['2']
	}, function(err, registrations){
		if(err){
			return callback(err, 500);
		}
		if(!registrations.length){
			return callback(new Error('No matching passes found in registration table'), 500);
		}
		/*
		When a device removes a registration, you can immediately remove the 
		entry from the registrations table.
		*/
		Registration.remove({
			deviceLibraryIdentifier : req.params['1'],
			serialNumber : req.params['3']
		}, function(err, removed){
			if(err){
				return callback(err, 500);
			}
			if(!removed){
				return callback(new Error('Error removing registration, removed registrations = 0'), 500);
			}
			if(registrations.length === 1){
				/*
				When there are no entries for a device in the registrations table, 
				you can remove the entry for the device from the devices table.
				*/
				Device.remove({
					deviceLibraryIdentifier : req.params['1']
				},function(err, removed){
					if(err){
						return callback(err, 500);
					}
					if(!removed){
						return callback(new Error('Error removing device, removed devices = 0'), 500);
					}
				});
				return callback(null, 200);
			}
			else{
				return callback(null, 200);
			}
		});
	});
};

exports.log = function(req, callback){
	callback(null, 200, req.body.logs);
};
