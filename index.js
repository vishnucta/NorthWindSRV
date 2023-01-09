const express = require("express");
const axios = require("axios");
const SapCfAxios = require("sap-cf-axios").default;
const xsenv = require('@sap/xsenv')
const https = require('https');

xsenv.loadEnv();
const dest_service = xsenv.getServices({ dest: { tag: 'destination' } }).dest;
const uaa_service = xsenv.getServices({ uaa: { tag: 'xsuaa' } }).uaa;
const conn_service = xsenv.getServices({ conn: { tag: 'connectivity' } }).conn;
const sUaaCredentials = dest_service.clientid + ':' + dest_service.clientsecret;
const sConnCredentials = conn_service.clientid + ':' + conn_service.clientsecret;
const sDestinationName = 'NorthWindDestination';
const sDestinationNameES5 = 'ES5VirtualBasicWurl';
// const sDestinationNameES5 = 'ES5Direct';

const app = express();
const PORT = process.env.PORT || 5000;

// console.log(xsenv.getServices({ dest: { tag: 'destination'} }));
//console.log(xsenv.getServices({ uaa: { tag: 'xsuaa' } }));
// console.log(sUaaCredentials);

// const axios1 = SapCfAxios("NorthWindDestination");
// const axios1 = SapCfAxios("ES5VirtualBasicWurl");

const handleCustomerRequest = async (req, res) => {


    const agent = new https.Agent({
        rejectUnauthorized: false
    });
    axios({
        url: uaa_service.url + '/oauth/token',
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(sUaaCredentials).toString('base64'),
            'Content-type': 'application/x-www-form-urlencoded'
        },
        data: {
            'client_id': dest_service.clientid,
            'grant_type': 'client_credentials'
        },
        httpsAgent: agent,
    }).then((response) => {
        const token = response.data.access_token;
        console.log(token);
        const token_type = response.data.token_type;
        const agent2 = new https.Agent({
            rejectUnauthorized: false
        });
        axios({
            url: dest_service.uri + '/destination-configuration/v1/destinations/' + sDestinationName,
            headers: {
                'Authorization': 'Bearer ' + token
            },
            httpsAgent: agent2,
        }).then((response) => {
            console.log(response.data.destinationConfiguration)
            const destinationConfiguration = response.data.destinationConfiguration;
            const agent2 = new https.Agent({
                rejectUnauthorized: false
            });
            axios({
                url: destinationConfiguration.URL + "/v4/northwind/northwind.svc/Customers",
                // url: destinationConfiguration.URL + "/SalesOrderSet('0500000001')/ToLineItems",
                method: "GET",
                params: {
                    $format: "json"
                },
                headers: {
                    accept: "application/json"
                },
                httpsAgent: agent2,
            }).then((response) => {
                res.send(response.data.value);
            })

        })
    })
}

const handleSalesRequest = async (req, res) => {

    // const connJwtToken = await _fetchJwtToken(conn_service.token_service_url, conn_service.clientid, conn_service.clientsecret)
    //console.log("connection token"+connJwtToken);
    const agent = new https.Agent({
        rejectUnauthorized: false
    });
    axios({
        url: uaa_service.url + '/oauth/token',
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(sUaaCredentials).toString('base64'),
            'Content-type': 'application/x-www-form-urlencoded'
        },
        data: {
            'client_id': dest_service.clientid,
            'grant_type': 'client_credentials'
        },
        httpsAgent: agent,
    }).then((response) => {
        const token = response.data.access_token;
        console.log("Destination token"+token);
        // const token_type = response.data.token_type;
        const agent2 = new https.Agent({
            rejectUnauthorized: false
        });
        axios({
            url: dest_service.uri + '/destination-configuration/v1/destinations/' + sDestinationNameES5,
            headers: {
                'Authorization': 'Bearer ' + token
            },
            httpsAgent: agent2,
        }).then((response) => {
            // console.log(response.data.destinationConfiguration)
            const destinationConfiguration = response.data.destinationConfiguration;
            const agent2 = new https.Agent({
                rejectUnauthorized: false
            });
            const encodedUser = Buffer.from(destinationConfiguration.User + ':' + destinationConfiguration.Password).toString("base64")
            

            axios({
                url: conn_service.url + '/oauth/token',
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(sConnCredentials).toString('base64'),
                    'Content-type': 'application/x-www-form-urlencoded'
                },
                data: {
                    'client_id': conn_service.clientid,
                    'grant_type': 'client_credentials'
                },
                httpsAgent: agent,
            }).then((response) => {
                const conntoken = response.data.access_token;
                console.log("connection token"+conntoken);
                axios({

                    url: destinationConfiguration.URL + "/SalesOrderSet('0500000001')",
                     method: 'GET',
                    params: {
                        $format: "json"
                    },
                    headers: {
                         accept: "application/json",
                        Authorization: "Basic " + encodedUser,
                        'Proxy-Authorization': 'Bearer ' + conntoken,
                        'SAP-Connectivity-SCC-Location_ID': ""
                    },
                    proxy: {
                        host: conn_service.onpremise_proxy_host,
                        port: conn_service.onpremise_proxy_http_port
                    },
                    // timeout:10,
                    // proxies:{
                    //     "http": conn_service.onpremise_proxy_host + ":" +  conn_service.onpremise_proxy_http_port
                    // },
                    httpsAgent: agent2,
                    // verify: false
                }).then((response) => {
                    res.send(response.data.value);
                })
            })



            

        })
    })
}

//to fetch auth token using URL, client and secret values
const _fetchJwtToken = async function (oauthUrl, oauthClient, oauthSecret) {
    return new Promise((resolve, reject) => {
        //prepare URL
        const tokenUrl = oauthUrl + '/oauth/token?grant_type=client_credentials&response_type=token'
        //prepare for the call
        const config = {
            headers: {
                Authorization: "Basic " + Buffer.from(oauthClient + ':' + oauthSecret).toString("base64")
            }
        }
        //backend get call to fetch auth token
        axios.get(tokenUrl, config)
            .then(response => {
                resolve(response.data.access_token)
            })
            .catch(error => {
                reject(error)
            })
    })
}
app.get("/Customers", handleCustomerRequest);
app.get("/Sales", handleSalesRequest);

app.listen(PORT, () => {
    console.log(`Listening on Port http://localhost:${PORT}`)
})
