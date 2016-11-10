This module provides API's for performing CRUD operations listed in [Wallet Developer Guide](https://developer.apple.com/library/content/documentation/UserExperience/Conceptual/PassKit_PG/Updating.html) and [PassKit Web Service Reference](https://developer.apple.com/library/content/documentation/PassKit/Reference/PassKit_WebService/WebService.html) for wallet push notifications.

wallet-mongoose relies on the [mongoose](https://www.npmjs.com/package/mongoose) module and provides error handling, caching and unit tests.

Plug this in between any [Authentication module](https://www.npmjs.com/package/jsonwebtoken) and a [Pass generating module](https://www.npmjs.com/package/passbook)

__Steps__:

1.Generate a Pass and save user data in the Pass schema

2.Wallet app makes REST calls when user adds Pass to the wallet app

3.Wallet requests -> Authenticate -> wallet-mongoose

## Installation
`$ npm install wallet-mongoose`

**Usage** :

__Sample schema with mandatory fields,__
~~~~
var deviceSchema = new Schema({
	deviceLibraryIdentifier : String,
	pushToken : String
});

var registrationSchema = new Schema({
	deviceLibraryIdentifier : String,
	passTypeIdentifier : String,
	serialNumber : String
});

var passSchema = new Schema({
	passTypeIdentifier : String,
	serialNumber : String,
	lastUpdated : {type : Number , default : 0}, // This can be UNIX time
	userName : String	// (Optional) Add in your custom fields for storing user data
});

var Device = mongoose.model('Device' , deviceSchema);
var Pass = mongoose.model('Pass' , passSchema);
var Registration = mongoose.model('Registration' , registrationSchema);
~~~~

__Generate Pass:__

Generate a Pass using any pass generating module and save the document in the Pass schema

Eg:
~~~~
var now = Date.now()
Pass.update({
        serialNumber : '1234',
        passTypeIdentifier : 'pass.com.company.team'
    },{
        passTypeIdentifier : 'pass.com.company.team',
        serialNumber : '1234',
        lastUpdated : now,
        userName : 'John Doe'
        }
    },{
        upsert : true,
        setDefaultsOnInsert : true
    },function(err , raw){
        if(err){
            ......
        }
   });

   /*
    For caching, wallet-mongoose uses the 'if-modified-since' header in the request to getPass(...) to send 304 if Pass.lastUpdated is <= req.headers['if-modified-since'] .
   */
    res.setHeader('Last-Modified', now);
~~~~

On clicking Add pass to the wallet app, the following REST calls are used by the wallet app.

__REST API's:__

1.Register
~~~~
var express = require('express');
var router = express.Router();
var authenticate = require('./authenticate'); // Plug in your authentication module, using jsonwebtoken for instance
var wallet = require('wallet-mongoose');

router.post('/webServiceURL/*/devices/*/registrations/*/*', authenticate.verify, function(req, res, next){
	wallet.register(req, Device, Registration, function(err, statusCode){
		if(err){
			res.sendStatus(statusCode);	// Send appropriate error status code
		}
		res.sendStatus(statusCode);	// Send appropriate success status code
	});
});
~~~~

2.Get Serial Numbers
~~~~
router.get('/webServiceURL/*/devices/*/registrations/*', function(req, res, next){
	wallet.getSerialNumbers(req, Registration, Pass, function(err, statusCode, responseBody){
		if(err){
			res.sendStatus(statusCode);
		}
		res.status(statusCode).send(responseBody);
	});
});
~~~~

3.Get Pass
~~~~
router.get('/webServiceURL/*/passes/*/*', authenticate.verify , function(req, res, next){
	wallet.getPass(req, Pass, function(err, statusCode, passData){
		if(err){
			res.sendStatus(statusCode);
		}
		// passData is the document in the Pass schema holding user's data
		/*
		 Call next module which uses passData and generates an actual Pass
		 The passbook module for example is capable of doing this
	 	*/
	 	next();
	});
});
~~~~

4.Unregister
~~~~
router.delete('/webServiceURL/*/devices/*/registrations/*/*' , authenticate.verify, function(req, res, next){
	wallet.unregister(req, Registration, Device, function(err, statusCode){
		if(err){
			res.sendStatus(statusCode);
		}
		res.sendStatus(statusCode);
	});
});
~~~~

5.Log
~~~~
router.post('/webServiceURL/*/log' , function(req, res, next){
	wallet.log(function(err, statusCode, log){
		console.log(log);	// Just logs to console
		res.sendStatus(statusCode);
	});
});
~~~~

__Testing__

Run mongod on mongodb://localhost:27017, then
~~~~
cd wallet-mongoose
npm install
npm test
~~~~

__Sharding__

Device collection can be hash sharded on the *deviceLibraryIdentifier* key.

Pass collection can be sharded on the *serialNumber + passTypeIdentifier* composite key.