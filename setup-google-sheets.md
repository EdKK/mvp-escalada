# Setting Up Google Sheets API

Follow these instructions to set up the Google Sheets API, create service accounts, get credentials, and configure your project.

## Step 1: Enable the Google Sheets API
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing project.
3. Navigate to the **API & Services** section.
4. Click on **Library**.
5. In the library, search for `Google Sheets API` and click on it.
6. Click the **Enable** button to enable the API for your project.

## Step 2: Create Service Account
1. In the Cloud Console, go to the **IAM & Admin** section.
2. Click on **Service Accounts**.
3. Click the **Create Service Account** button at the top.
4. Fill in the service account name and description.
5. Click **Create**.
6. Optionally assign roles needed for your project, then click **Continue**.
7. Click **Done** to finish creating the service account.

## Step 3: Generate Credentials
1. In the Service Accounts page, locate the service account you created.
2. Click on the service account to open its details.
3. Navigate to the **Keys** tab.
4. Click on **Add Key** and select **JSON**.
5. A JSON file will be downloaded; keep this file safe as it contains your credentials.

## Step 4: Share Your Google Sheet
1. Open the Google Sheet you want to access via the API.
2. Click on the **Share** button.
3. In the sharing settings, add the email address of your service account (you can find it in the service account details in the Cloud Console).
4. Click **Done** to save the settings.

## Step 5: Configure Your Project
1. Install the required libraries for your programming language (e.g., `googleapis` for Node.js, `google-api-python-client` for Python).
2. Load the JSON credentials file in your project.
3. Use the necessary APIs to authenticate and make requests to the Google Sheets API.

### Example
Here is an example of how to authenticate using the credentials in Python:
```python
from google.oauth2.service_account import Credentials
import gspread

# Load credentials
creds = Credentials.from_service_account_file('path/to/your/credentials.json')
client = gspread.authorize(creds)

# Open the Google Sheet
sheet = client.open('Your Google Sheet Title').sheet1
```

## Conclusion
You have now set up the Google Sheets API, created a service account, obtained credentials, and configured your project. You can now interact with Google Sheets programmatically!