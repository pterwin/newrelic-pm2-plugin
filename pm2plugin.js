var pm2 = require('pm2');
var os = require('os');
var request = require('request');

// Plugin Variables
var config = require('./config.json');
var ver = config.nrversion;
var license = config.nrlicense;
var guid = config.nrguid;
var url = config.nrurl;
var _ = require('lodash')._;

function poll()
{
	// Connect or launch pm2
	pm2.connect(function(err){

		console.log('Just connected to PM2');

		// Pull down the list
		pm2.list(function(err, list) {

			// Start an output message
			var msg = {};

			// Create the agent subsection
			var agent = {};
			msg.agent = agent;
			agent.host = os.hostname();
			agent.pid = process.pid;
			agent.version = ver;

			// Create the components array (with only 1 value)
			var components = {};

			list.forEach(function(proc) {
                var pname = proc.pm2_env.name;


                var metrics = {
                    uptime   : calcUptime(proc.pm2_env.pm_uptime),
                    restarts : proc.pm2_env.restart_time,
                    cpu      : proc.monit.cpu,
                    memory   : proc.monit.memory,
                };

                if(!components[pname]) {
                    components[pname] = {
                        name     : proc.pm2_env.name,
                        guid     : guid,
                        duration : 30,
                        metrics: []
                    };
                }

                components[pname].metrics.push(metrics);
			});


            msg.components = [];

            _.each(components, function(comp) {

                var metrics       = {};
                var proccount     = 1;
                var totalUptime   = 0;
                var totalRestarts = 0;
                var totalCpu      = 0;
                var totalMemory   = 0;

                _.each(comp.metrics, function(metric) {
                    var pname = comp.name + proccount;
                    metrics['Component/process/'+pname+'[uptime]'] = metric.uptime;
                    metrics['Component/process/'+pname+'[restarts]'] = metric.restarts;
                    metrics['Component/process/'+pname+'[cpu]'] = metric.cpu;
                    metrics['Component/process/'+pname+'[memory]'] = metric.memory;

                    totalUptime   +=metric.uptime;
                    totalRestarts +=metric.restarts;
                    totalCpu      +=metric.cpu;
                    totalMemory   +=metric.memory;
                    proccount++;
                });

                metrics['Component/rollup/all[uptime]'] = totalUptime;
                metrics['Component/rollup/all[restarts]'] = totalRestarts;
                metrics['Component/rollup/all[cpu]'] = totalCpu;
                metrics['Component/rollup/all[memory]'] = totalMemory;

                comp.metrics = metrics;
                msg.components.push(comp);
            });




			//console.log(components);
            console.log(msg.components);
			postToNewRelic(msg);

			// Disconnect from PM2
			//pm2.disconnect();
		});
	});

	// Re-run every 30s
	setTimeout(poll, 30000)
}

function postToNewRelic(msg) {
	var msgString = JSON.stringify(msg);
	request({
		url: url,
		method: "POST",
		headers: {
			'Content-Type': 'application/json',
			'Accept': 'application/json',
			'X-License-Key': license
		},
		body: msgString
	}, function (err, httpResponse, body) {
		if (!err) {
			console.log('New Relic Reponse: %d', httpResponse.statusCode);
			if(body) {
				console.log('Response from NR: ' + body);
			}
		} else {
			console.log('*** ERROR ***');
			console.log(err);
		}
	});
	// console.log('Just posted to New Relic: %s', msgString);
}

function calcUptime(date) {
	var seconds = Math.floor((new Date() - date) / 1000);
	return seconds;
}

poll();
