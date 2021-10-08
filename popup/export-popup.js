//Declare functions
function initializeExports(){
   chrome.downloads.search({query: ["wp-personal-data-file"],orderBy: ["-startTime"]},function(existingExports){
      console.log(`Found ${existingExports.length} existing exports to delete`)
      existingExports.forEach((existingExport) => {
         chrome.downloads.removeFile(existingExport.id,function(){
            chrome.downloads.erase({id: existingExport.id},function(){
               console.log(`Existing export ${existingExport.id} deleted`);
            });
         });
      });
   });
};
function openExportPage(){
   chrome.tabs.create({url: tabUrl,active: false},function(tab){
      //Display/log current step
      liveDisplay.innerHTML = `<p>Fetching exports</p><img src="spinner.gif" id="loading">`;
      //Capture tab ID
      siteId = tab.id;
      //Log successful tab open
      console.log(`Tab ID ${siteId} opened with URL ${tabUrl}\nListening for downloads`);
   });
};
function resetCount(){
   dlCount = 0;
   retries = 0;
   chrome.downloads.erase({query: ["wp-personal-data-file"],orderBy: ["-startTime"]},function(erased){
      console.log(`Found ${erased.length} exports to erase from history`)
      erased.forEach((erasedItem) => {
         console.log(`Export ${erasedItem.id} erased from history`);
      });
   });
};
function deleteDuplicates(){
   chrome.downloads.search({query: ["wp-personal-data-file","(",")"],orderBy: ["-startTime"]},function(duplicates){
      console.log(`Found ${duplicates.length} duplicates to delete`)
      duplicates.forEach((duplicate) => {
         chrome.downloads.removeFile(duplicate.id,function(){
            chrome.downloads.erase({id: duplicate.id},function(){
               console.log(`Duplicate ${duplicate.id} deleted`);
            });
         });
      });
   });
};
function deleteUnconfirmed(){
   chrome.downloads.search({query: ["Unconfirmed",".crdownload"],orderBy: ["-startTime"]},function(unconfirmed){
      console.log(`Found ${unconfirmed.length} unconfirmed downloads to delete`)
      unconfirmed.forEach((file) => {
         chrome.downloads.removeFile(file.id,function(){
            chrome.downloads.erase({id: file.id},function(){
               console.log(`Duplicate ${file.id} deleted`);
            });
         });
      });
   });
}
function retryDownloads(){
   retries++;
   liveDisplay.innerHTML = `<p>Re-downloading ${retries} times</p><img src="spinner.gif" id="loading">`;
   console.log("Sending retry command to site")
   chrome.tabs.sendMessage(siteId,{command: "retry"},function(siteResponse){
      console.log(`Site response: ${siteResponse.status}`);
   });
};
function closeExportPage(){
      chrome.tabs.remove(siteId,function(){
         console.log(`Tab ${siteId} closed. Updating launcher page`);
         chrome.tabs.sendMessage(launcherId,{status: "tab closed"},function(response){
            console.log(`Launcher page response: ${response.status}`);
            if(response.status === "complete"){
               liveDisplay.innerHTML = `<p>Fetching complete</p>`
               if(response.incomplete.length > 0){
                  window.prompt(`Some sites didn't finish. Please note the incomplete sites below (CTRL+C to copy):`,response.incomplete.join("\n"));
                  console.log(`Some sites didn't finish. Please note the incomplete sites below:\n${response.incomplete.join("\n")}`);
               };
            };
         });
      });
};
function displayFailure(){
   countDisplay.innerHTML = `${dlCount}<p style="color:red;">Not enough exports</p>`;
   countDisplay.setAttribute('style',"color:red;");
   liveDisplay.innerHTML = ``;
};
function displaySuccess(){
   countDisplay.innerHTML = `${dlCount}<p style="color:blue;">Exports retrieved</p>`;
   countDisplay.setAttribute('style',"color:blue;");
   liveDisplay.innerHTML = ``;
};
//Initialize global variables
let dlCount = 0;
let launcherId = 0;
let siteId = 0;
let tabUrl = "";
let retries = 0;
let liveDisplay = document.getElementById('display');
let countDisplay = document.getElementById('count');
//Remind user to log into SSO
window.alert("Please ensure the following before fetching exports:\n\n- You are logged into NBCU SSO\n- You've allowed your browser to download multiple files on all sites\n- Your computer does not go into sleep mode during fetching")
//Query for launcher tab
chrome.tabs.query({active: true,currentWindow: true},function(tabs){
   launcherId = tabs[0].id;
   console.log(`Launcher tab ID: ${launcherId}`)
   //Listen for clicks on 'run'
   document.getElementById('fetch').addEventListener('click',function(){
      //Display current function
      liveDisplay.innerHTML = `<p>Initializing downloads</p><img src="spinner.gif" id="loading">`;
      //Initialize downloads by deleting all existing exports
      initializeExports();
      //Send launcher 'start' command to begin opening new Export pages
      setTimeout(() => {
         //Log extension message
         console.log(`Sending start command to launcher page`)
         chrome.tabs.sendMessage(launcherId,{command: "start"},function(response){
            console.log(`Launcher page response: ${response.status}`);
         });
      },2000);
   });
});
//Listen for messages from launcher page
chrome.runtime.onMessage.addListener(function(request){
   if(request.command === 'new tab'){
      //Capture export page URL
      tabUrl = request.tabUrl;
      //If 'new' message from launcher, create new non-active tab
      openExportPage();
   }
   //Listen for messages from export-page
   if(request.status === "downloaded"){
      //Display/log current step
      liveDisplay.innerHTML = `<p>Downloads complete. Deleting duplicates</p><img src="spinner.gif" id="loading">`;
      console.log(`Downloads complete\nList length is ${request.listLength}\nDeleting duplicates and counting`);
      deleteDuplicates();
      deleteUnconfirmed();
      setTimeout(() => {
         chrome.downloads.search({query: ["wp-personal-data-file"],orderBy: ["-startTime"]},(downloads) => {
            //Capture export count
            dlCount = downloads.length;
            console.log(`After removing duplicates, found ${dlCount} unique exports`);
            //If export count is less than the Wordpress list
            if(dlCount < request.listLength){
               if(retries < 3){
                  displayFailure();
                  setTimeout(() => {retryDownloads();},1000);
               }else{
                  //If retry limit reached
                  displayFailure();
                  liveDisplay.innerHTML = `<p style="color:red;">Retry limit reached. Flagging site as incomplete</p>`;
                  console.log(`Retry limit reached on tab ${siteId}. Updating launcher page`)
                  chrome.tabs.sendMessage(launcherId,{status: "retry limit reached"},function(response){
                     console.log(`Launcher page response: ${response.status}`);
                  });
                  //Clear downloads and reset count
                  setTimeout(() => {
                     liveDisplay.innerHTML = `<p>Deleting duplicates/p><img src="spinner.gif" id="loading">`;
                     deleteDuplicates();
                     deleteUnconfirmed();
                     setTimeout(() => {
                        liveDisplay.innerHTML = `<p>Clearing download history</p><img src="spinner.gif" id="loading">`;
                        resetCount();
                        countDisplay.innerText = ``;
                        setTimeout(() => {
                           liveDisplay.innerHTML = `<p>Closing site</p>`;
                           closeExportPage();
                        },2000);
                     },2000);
                  },2000);
               }
            } else {
               //If export count is greater than or equal to the Wordpress list
               displaySuccess();
               setTimeout(() => {
                  liveDisplay.innerHTML = `<p>Clearing download history</p>`;
                  console.log(`Exports retrieved. Resetting count and closing site`);
                  resetCount();
                  setTimeout(() => {
                     countDisplay.innerText = ``;
                     liveDisplay.innerHTML = `<p>Closing site</p>`;
                     closeExportPage();
                  },2000);
               },1000);
            };
         });
      },2000);
   }
});
//Listen for URL changes on the tabs (Errors)
chrome.tabs.onUpdated.addListener(function(tabId,changeInfo,tabInfo){
   console.log("A tab update event was fired");
   if(changeInfo.url){
      if(changeInfo.url.includes("/wp-content/")){
         console.log(`An error occured while downloading\nReloading export page`);
         liveDisplay.innerHTML = `<p style="color:red;font-style:normal;">An error occured while fetching</p><p>Re-downloading</p><img src="spinner.gif" id="loading">`;
         setTimeout(() => {
            chrome.tabs.remove(siteId,function(){
               openExportPage();
            },1000);
         });
      };
   };
});