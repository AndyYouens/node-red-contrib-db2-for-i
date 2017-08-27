
module.exports = function(RED) {    
    "use strict";
    var reconnect = 30000;
    //var db2 = require('ibm_db');
    var Promise = require('promise');
    var db = require('/QOpenSys/QIBM/ProdData/OPS/Node6/os400/db2i/lib/db2a');
    

    function ibm-db2-for-i-Node(n) {
        RED.nodes.createNode(this,n);
        this.host = n.host;
        this.connected = false;
        this.connecting = false;
        this.dbname = n.db;
        var node = this;

        function doConnect(conncb) {
            node.connecting = true;
            node.emit("state","connecting");
            node.conn = {};
            var dbconn = new db.dbconn();
            node.connection = {
                connect: (cb) => {
                    /*
                    var conStr = "DRIVER={DB2};DATABASE="+node.dbname
                                +";HOSTNAME="+node.host
                                +";UID="+node.credentials.user
                                +";PWD="+node.credentials.password
                                +";PORT="+node.port+";PROTOCOL=TCPIP"; 
                    db2.open(conStr, function (err,conn) {
                        if (err) {
                            cb(err, null);  
                        } 
                        else {
                            console.log('connection to ' + node.dbname);
                            conn.connName = node.dbname;        
                            cb(null, conn);
                        }
                    }); */
                  
                  dbconn.conn(node.dbname, node.credentials.user, node.credentials.password);  // Connect to the DB  
                  console.log('connection to ' + node.dbname);  
                   cb(null, conn);    
                },
                end: (conn) => {
                    delete dbconn;
                    console.log('connection closed');
                    /*conn.close(() => {
                        console.log('connection closed');
                    });*/
                }
            };
            node.connection.connect(function(err, conn) {
                node.connecting = false;
                if (err) {
                    node.error(err);
                    console.log("connection error " + err);
                } else {
                    node.conn = conn;
                    node.connected = true;
                }
                conncb(err);
            });
        }

        this.connect = function() {
            return new Promise((resolve, reject) => {
                if (!this.connected && !this.connecting) {
                    doConnect((err)=>{
                        if(err) reject(err);
                        else resolve();
                    });
                }  
                else{
                    resolve();
                }  
            });
        }

        this.on('close', function (done) {
            if (this.connection) {
                node.connection.end(this.conn);
            } 
            done();
        });
    }
    
    RED.nodes.registerType("ibm-db2fori-db", ibm-db2-for-i-Node, {
        credentials: {
            user: {type: "text"},
            password: {type: "password"}
        }
    });
    
    function ibm-db2-for-i-NodeIn(n) {
   
        RED.nodes.createNode(this,n);
        this.mydb = n.mydb;
        var node = this;

        node.query = function(node, db, msg){
            if ( msg.payload !== null && typeof msg.payload === 'string' && msg.payload !== '') {
                
                 var sqlB = new db.dbstmt(dbconn2);
                sqlB.exec(msg.payload, function(err, rows) {
                    if (err) { 
                        console.log("QUERY ERROR "+ err);
                        node.error(err,msg); 
                    }
                    else {
                        rows.forEach(function(row) {
                            node.send({ topic: msg.topic, payload: row });
                        })
                        node.send([ null, { topic: msg.topic, control: 'end' }]);
                    }
                });
                
                /*db.conn.query(msg.payload, function(err, rows) {
                    if (err) { 
                        console.log("QUERY ERROR "+ err);
                        node.error(err,msg); 
                    }
                    else {
                        rows.forEach(function(row) {
                            node.send({ topic: msg.topic, payload: row });
                        })
                        node.send([ null, { topic: msg.topic, control: 'end' }]);
                    }
                });*/
            }
            else {
                if (msg.payload === null) { 
                    node.error("msg.payload : the query is not defined");
                }
                if (typeof msg.payload !== 'string') { 
                    node.error("msg.payload : the query is not defined as a string");
                }
                if (typeof msg.payload === 'string' && msg.payload === '') { 
                    node.error("msg.payload : the query string is empty");
                }
            }
        }

        node.on("input", (msg) => {
            if ( msg.database !== null && typeof msg.database === 'string' && msg.database !== '') {
                node.mydbNode = RED.nodes.getNode(n.mydb);
                if (node.mydbNode) {
                    node.send([ null, { control: 'start', query: msg.payload, database: n.mydb } ]);
                    if(node.mydbNode.conn && node.mydbNode.conn.connName === msg.database){
                        console.log("already connected");
                        node.query(node, node.mydbNode, msg);
                    }
                    else{
                        var findNode;
                        RED.nodes.eachNode((node)=>{
                            if(node.db && node.db === msg.database){
                                findNode = RED.nodes.getNode(node.id);
                                node.mydb = node.id;
                            }
                        })
                        findNode.connect()
                        .then(()=>{
                            node.query(node, findNode, msg);
                        });
                    }
                }
                else {
                    this.error("database not configured");
                }
            }
            else{
                this.error("database not specified");
            }
        });
    }
    RED.nodes.registerType("ibmdb2-for-i", ibm-db2-for-i-NodeIn);
}
