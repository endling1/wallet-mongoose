var mocha = require('mocha');
var mongoose = require('mongoose');
var expect = require('chai').expect;
var wallet = require('../index');

var handle = mongoose.connect('mongodb://localhost:27017/TestDB');

mongoose.connection.on('connected' , function(){
	console.log('Mongoose connection successfull');
});

mongoose.connection.on('error' , function(err){
	console.log('Mongoose connection error : ' + err);
});

mongoose.connection.on('disconnected' , function(){
	console.log('Mongoose connection disconnected');
});

var Schema = mongoose.Schema;

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
	lastUpdated : {type : Number , default : 0},
	userName : String
});

var Device = mongoose.model('Device' , deviceSchema);
var Pass = mongoose.model('Pass' , passSchema);
var Registration = mongoose.model('Registration' , registrationSchema);

var version = 'v1';
var deviceLibraryIdentifier = '9c52194f0ddc885343718ff0f3aedaad';
var passTypeIdentifier = 'pass.com.company.team';
var serialNumber = '85c4433-4d3e-a696-caa77ced0';
var pushToken = 'b8e0eef09a33a32177e551b40eea938d0f9ea145d5';

var deviceLibraryIdentifier2 = '9c52194f0ddc885343718ff0f3aedaad';
var passTypeIdentifier2 = 'pass.com.company.team';
var serialNumber2 = '65c3433-4d3e-4696-c2a47ced0';
var pushToken2 = 'h800jef08a35a32177e951b40eek838d0f9pa142d5';

var now = Date.now();

// POST request to webServiceURL/version/devices/deviceLibraryIdentifier/registrations/passTypeIdentifier/serialNumber
describe('Test registration', function(){
	var req = {};
	req.params = [version, deviceLibraryIdentifier, passTypeIdentifier, serialNumber];
	req.body = {}; req.body.pushToken = pushToken;

	var req2 = {};
	req2.params = [version, deviceLibraryIdentifier2, passTypeIdentifier2, serialNumber2];
	req2.body = {}; req2.body.pushToken = pushToken2;
	
	before(function(done){
		Device.remove({}, function(err){
			if(err){
				throw err;
			}
			Registration.remove({}, function(err){
				if(err){
					throw err;
				}
				Pass.remove({}, function(err){
					if(err){
						throw err;
					}
					done();
				});
			});
		});
	});

	it('Should return HTTP status 201 if registration succeeds', function(done){
		wallet.register(req, Device, Registration, function(err, status){
			expect(status).to.equal(201);
			done();
		});
	});

	it('Should return HTTP status 201 if registration succeeds', function(done){
		wallet.register(req2, Device, Registration, function(err, status){
			expect(status).to.equal(201);
			done();
		});
	});

	it('Should return HTTP status 200 if serial number is already registered for this device', function(done){
		wallet.register(req, Device, Registration, function(err, status){
			expect(status).to.equal(200);
			done();
		});
	});
});

// GET request to webServiceURL/version/devices/deviceLibraryIdentifier/registrations/passTypeIdentifier?passesUpdatedSince=tag
describe('Test getSerialNumbers', function(){
	var userName = 'John Doe';
	var userName2 = 'Jane Doe';
	var req = {};
	req.params = [version, deviceLibraryIdentifier, passTypeIdentifier];
	req.query = {};

	before(function(done){
		var newUser = new Pass({
			passTypeIdentifier : passTypeIdentifier,
			serialNumber : serialNumber,
			lastUpdated : now,
			userName : userName
		});

		// Second user, a millisecond later
		var newUser2 = new Pass({
			passTypeIdentifier : passTypeIdentifier2,
			serialNumber : serialNumber2,
			lastUpdated : now + 1,
			userName : userName2
		}); 

		newUser.save(newUser, function(err){
			if(err){
				throw err;
			}
			newUser2.save(newUser, function(err){
				if(err){
					throw err;
				}
				done();
			});
		});
	});

	it('Should return HTTP status 200 with serialNumberList on success', function(done){
		wallet.getSerialNumbers(req, Registration, Pass, function(err, status, responseBody){
			expect(status).to.equal(200);
			expect(responseBody.serialNumbers).to.deep.equal([serialNumber.toString(), serialNumber2.toString()]);
			expect(responseBody.lastUpdated).to.equal((now + 1).toString());
			done();
		});
	});

	it('Should return HTTP status 200 with empty serialNumberList on success' + 
		'Returns only the passes that have been updated since the time indicated by passesUpdatedSince tag', function(done){
		req.query.passesUpdatedSince = now + 1;
		wallet.getSerialNumbers(req, Registration, Pass, function(err, status, responseBody){
			expect(status).to.equal(200);
			expect(responseBody.serialNumbers).to.deep.equal([]);
			expect(responseBody.lastUpdated).to.equal((now + 1).toString());
			done();
		});
	});

	it('Should return HTTP status 204 for no matching passes', function(done){
		req.query.passesUpdatedSince = 0;
		req.params[1] = '1234';
		wallet.getSerialNumbers(req, Registration, Pass, function(err, status, responseBody){
			expect(status).to.equal(204);
			done();
		});
	});

	it('Should return HTTP status 200 and serialNumberList on success.' +
		'Returns only the passes that have been updated since the time indicated by passesUpdatedSince tag', function(done){
		req.params[1] = deviceLibraryIdentifier;
		req.query.passesUpdatedSince = (now + 1);

		Pass.update({
			userName : 'Jane Doe'
		}, {
			lastUpdated : (now + 20000)
		}, function(err){
			if(err){
				throw err;
			}
			wallet.getSerialNumbers(req, Registration, Pass, function(err, status, responseBody){
				expect(status).to.equal(200);
				expect(responseBody.serialNumbers).to.deep.equal([serialNumber2.toString()]);
				expect(responseBody.lastUpdated).to.equal((now + 20000).toString());
				done();
			});
		});
	});
});

// GET request to webServiceURL/version/passes/passTypeIdentifier/serialNumber
describe('Test getPass', function(){
	var req = {};
	req.params = [version, passTypeIdentifier, serialNumber];

	it('Should return HTTP status code 200 and pass data of John Doe on success', function(done){
		req.headers = {}; req.headers['if-modified-since'] = 0;
		wallet.getPass(req, Pass, function(err, status, passData){
			expect(status).to.equal(200);
			expect(passData.userName).to.equal('John Doe');
			done();
		});
	});

	it('Should return HTTP status code 304 as the pass has not changed', function(done){
		req.headers = {}; req.headers['if-modified-since'] = now;
		wallet.getPass(req, Pass, function(err, status, passData){
			expect(status).to.equal(304);
			done();
		});
	});

	it('Should return HTTP status code 500 for invalid serialNumber', function(done){
		req.headers = {}; req.headers['if-modified-since'] = now;
		req.params[2] = '1234';
		wallet.getPass(req, Pass, function(err, status, passData){
			expect(status).to.equal(500);
			done();
		});
	});
});

// DELETE request to webServiceURL/version/devices/deviceLibraryIdentifier/registrations/passTypeIdentifier/serialNumber
describe('Test unregister', function(){
	var req = {};
	req.params = [version, deviceLibraryIdentifier, passTypeIdentifier, serialNumber];

	// John Doe
	it('Should return HTTP status code 200 if unregistering succeeds', function(done){
		wallet.unregister(req, Registration, Device, function(err, status){
			expect(status).to.equal(200);
			done();
		});
	});

	// Jane Doe
	it('Should return HTTP status code 200 if unregistering succeeds and device entry removed from device table', function(done){
		req.params[3] = serialNumber2;
		wallet.unregister(req, Registration, Device, function(err, status){
			expect(status).to.equal(200);
			done();
		});
	});

	it('Should return HTTP status code 500 as no entries in registration table', function(done){
		wallet.unregister(req, Registration, Device, function(err, status){
			expect(status).to.equal(500);
			done();
		});
	});
});

// POST request to webServiceURL/version/log
describe('Test log', function(){
	var logs = ['Log 1', 'Log 2'];
	var req = {}; req.body = {};
	req.body.logs = logs;
	it('Should pass req.body.logs to callback paramater logArray', function(done){
		wallet.log(req, function(err, status, logArray){
			expect(status).to.equal(200);
			expect(logArray).to.deep.equal(logs);
			done();
		});
	});

	after(function(done){
		Device.remove({}, function(err){
			if(err){
				throw err;
			}
			Registration.remove({}, function(err){
				if(err){
					throw err;
				}
				Pass.remove({}, function(err){
					if(err){
						throw err;
					}
					mongoose.connection.db.dropDatabase();
					done();
				});
			});
		});
	});
});



