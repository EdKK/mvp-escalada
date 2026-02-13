// google-sheets-client.js

// Load the Google API client
function loadGoogleAPI() {
    return new Promise((resolve, reject) => {
        gapi.load('client:auth2', () => {
            resolve();
        });
    });
}

// Authenticate with OAuth 2.0
function authenticate() {
    return gapi.auth2.getAuthInstance() 
        .signIn({scope: "https://www.googleapis.com/auth/spreadsheets"}) 
        .then(() => { console.log("Welcome!" + gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile().getName()); },
              (err) => { console.error("Error signing in", err); });
}

// Load client library
function loadClient() {
    return gapi.client 
        .init({
            apiKey: 'YOUR_API_KEY',
            clientId: 'YOUR_CLIENT_ID',
            discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
            scope: "https://www.googleapis.com/auth/spreadsheets",
        })
        .then(() => { console.log("GAPI client loaded for API" ); },
              (err) => { console.error("Error loading GAPI client for API", err); });
}

// Read data from a sheet
function readSheet(spreadsheetId, range) {
    return gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: range,
    }).then((response) => {
        const range = response.result;
        if (range.values.length > 0) {
            console.log("Data from sheet:", range.values);
        } else {
            console.log("No data found.");
        }
    }, (err) => { console.error("Error: " + err); });
}

// Write data to a sheet
function writeSheet(spreadsheetId, range, values) {
    const body = {
        values: values
    };
    return gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: range,
        valueInputOption: "RAW",
        resource: body
    }).then((response) => {
        console.log(`${response.result.updatedCells} cells updated.`);
    }, (err) => { console.error("Error: " + err); });
}