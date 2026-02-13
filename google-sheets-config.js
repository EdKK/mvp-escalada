// google-sheets-config.js
// Google Sheets API integration code

const { google } = require('googleapis');

// Initialize the Google Sheets API client
const sheets = google.sheets({ version: 'v4' });

// Authenticate with the Google Sheets API
async function authenticate() {
    const auth = new google.auth.GoogleAuth({
        keyFile: 'path/to/your/credentials.json', // Path to your service account key
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return await auth.getClient();
}

// Function to read data from a Google Sheet
async function readSheet(spreadsheetId, range) {
    const auth = await authenticate();
    const response = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range,
    });
    return response.data.values;
}

// Function to write data to a Google Sheet
async function writeSheet(spreadsheetId, range, values) {
    const auth = await authenticate();
    const resource = { values };
    const response = await sheets.spreadsheets.values.update({
        auth,
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource,
    });
    return response.data;
}

module.exports = { readSheet, writeSheet };