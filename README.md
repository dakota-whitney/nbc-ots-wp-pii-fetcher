# nbc-ots-wp-pii-fetcher
Chrome browser extension developed for the purpose of downloading NBC OTS personal data export files from Wordpress to check for potential Personally Identifying Information (PII).

# How It Works
- The manifest.json file is configured to inject launcher.js into 2 NBC OTS Wordpress Admin pages when loaded in the browser:  
  https://ots.nbcwpshield.com/wp-admin/my-sites.php  
  https://vip-microsites.nbcwpshield.com/wp-admin/network/sites.php

- When the extension button is clicked, it triggers launcher.js to render a temporary display on the top of the Admin page, scan the page for each Site's wp-admin URL, add the export-personal-data.php suffix to the URL, and sends the new URL to background.js so it can open a new tab with the new URL

- The manifest.json file is configured to inject export-personal-data.js into each Site's export personal data page. When the page finishes loading, the script scans the page for users and their corresponding data requests, sends the user email addresses and number of requests to background.js, and begins clicking each user's export personal data link with a 2 second delay between each click

- When the last link is clicked, the script will wait 10 seconds to give the page time to download the last few .zip files, and the let the background.js script know that it can begin counting the downloaded files

- background.js will search the browser's Download Manager for files that includes wp-personal-data-file in its name, delete any duplicates, and count the number of unique export files for the current run

- When counting is finished, background.js will compare its export count to the number of data requests scanned on the current export page, and if it is less than the number of requests, it will tell export-personal-data.js to try downloads again

- When background.js detects that the number of uniqe exports downloaded matches the number of data requests scanned, it will highlight the site blue on the admin page, clear the browser's history of any wp-personal-data-files and continue to the next site

- If after 3 attempts of downloading results in failures, background.js will tell launcher.js to add the current site to an array of incomplete sites, highlight the site red on the admin page, and continue to the next site.

- Once all export pages have been opened and downloads attempted, background.js will stop its excution code and display a pop-up alert of the incompleted sites if there are any.

# Potential bugs and their remediations
The WP PII Fetcher has code that accounts for a few different potential bug scenarios during fetching:

- If you are not logged in to SSO on any of the sites, the extension cannot begin the download process. In this case, the extension will alert the user so that they may log in and re-attempt downloads

- If the export page can't handle the amout of downloads it is doing, the page may throw an error, changing its URL to the source of the current .zip file it was trying to download. The extension listens for URL changes that include /wp-content/ (.zip file source) and will reload the tab to re-attempt downloads

- If the page throws 3 errors on one site, the extension will tell launcher.js to add the current site to an array of incomplete sites, highlight the site red on the admin page, and continue to the next site

- The methodology used to inject the content scripts into the Admin and export pages may result in export pages attempting downloads no matter if you're running the extension or not. In this scenario, the extension is coded to listen for refreshes on the Admin page and will stop its execution so that export pages don't attempt downloads each time the user navigates to the export page