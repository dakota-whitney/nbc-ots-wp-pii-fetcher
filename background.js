//Delcare global functions
function displayProcess(process){
   launcherPort.postMessage({command: "display",currentProcess: process});
};
function displayCount(successful){
   launcherPort.postMessage({command: "display",count: dlCount,wasSuccessful: successful});
};
function initializeExports(){
   displayProcess("Initializing download manager...");
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
   displayProcess("Opening next site...");
   chrome.tabs.create({windowId: windowId,url: exportUrl,active: false},function(tab){
      //Capture tab ID
      siteId = tab.id;
      //Log successful tab open
      console.log(`Tab ID ${siteId} opened with URL ${exportUrl}\nListening for downloads`);
    });
 };
 function deleteDuplicates(){
   displayProcess("Downloads complete. Deleting duplicates...");
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
};
function retryDownloads(){
   retries++;
   displayProcess(`Re-downloading ${retries} time(s)...`);
   console.log("Sending retry command to site")
   chrome.tabs.sendMessage(siteId,{command: "retry"},function(response){
      console.log(`Site response: ${response.status}`);
   });
};
function resetCount(){
   displayProcess("Clearing download history...");
   dlCount = 0;
   retries = 0;
   chrome.downloads.erase({query: ["wp-personal-data-file"],orderBy: ["-startTime"]},function(erased){
      console.log(`Found ${erased.length} exports to erase from history`);
      erased.forEach((erasedItem) => {
         console.log(`Export ${erasedItem.id} erased from history`);
      });
   });
};
function closeExportPage(){
   displayProcess("Closing site");
   chrome.tabs.remove(siteId,function(){
      console.log(`Tab ${siteId} closed. Opening next site`);
      launcherPort.postMessage({command: "open"});
   });
};
//Declare global variables
let launcherPort = 0;
let windowId = 0;
let launcherId = 0;
let siteId = 0;
let exportUrl = "";
let dlCount = 0;
let retries = 0;
let running = false;
chrome.browserAction.onClicked.addListener(function(tab){
   if(tab.url.includes("/wp-admin/my-sites")){
      running = window.confirm("Please confirm the following before fetching exports:\n\n- You are logged into NBCU SSO in your current browser session\n\n- You've deleted any existing exports from your Downloads folder\n\n- You've allowed your browser to download multiple files on all Sites");
      if(running){
         chrome.windows.getCurrent(function(window){
            windowId = window.id;
         });
         launcherId = tab.id;
         console.log(`Launcher ID: ${launcherId}`)
         chrome.tabs.sendMessage(launcherId,{command: "render display"},function(response){
            if(response.request === "initialize"){
               console.log("Launcher page rendered display\nInitializing exports");
               initializeExports();
               setTimeout(() => {launcherPort.postMessage({command: "open"})},2000);
            };
         });
      };
   };
});
chrome.runtime.onConnect.addListener(function(port){
   launcherPort = port;
   console.log(`Connected to launcher on ${launcherPort.name}`);
   launcherPort.onMessage.addListener(function(message){
      switch(message.request){
         case "new tab":
            console.log("Received new tab request from launcher");
            //Capture export page URL
            exportUrl = message.exportUrl;
            //If 'new' message from launcher, create new non-active tab
            openExportPage();
         break;
         case "complete":
            console.log("Received complete request from launcher");
            if(message.incomplete.length > 0){
               window.alert(`Some sites didn't finish. Please note the incomplete sites below\n:${message.incomplete.join("\n")}`);
               console.log(`Some sites didn't finish. Please note the incomplete sites below:\n${message.incomplete.join("\n")}`);
            };
            running = false;
            launcherPort.disconnect;
         break;
      };
   });
});
chrome.runtime.onMessage.addListener(
   function(message,sender,sendResponse){
      switch(message.request){
         case "download":
         console.log("Export page has fully loaded\nReceived download request from export page");
         if(running){
            chrome.tabs.sendMessage(siteId,{command: "start downloads"},function(){
               displayProcess("Fetching exports...");
            });
         };
      break;
      case "count exports":
         console.log(`Received count request from export page\nList length is ${message.listLength}\nDeleting duplicates and counting`);
         deleteDuplicates();
         deleteUnconfirmed();
         setTimeout(() => {
            chrome.downloads.search({query: ["wp-personal-data-file"],orderBy: ["-startTime"]},(downloads) => {
               //Capture export count
               dlCount = downloads.length;
               console.log(`After removing duplicates, found ${dlCount} unique exports`);
               //Failed run
               if(dlCount < message.listLength){
                  displayCount(false);
                  //If under retry limit
                  if(retries < 3){
                     setTimeout(() => {retryDownloads();},1000);
                  }else{ //Retry limit reached
                     displayProcess("Retry limit reached. Marking incomplete");
                     console.log(`Retry limit reached on tab ${siteId}. Updating launcher page`);
                     launcherPort.postMessage({command: "incomplete"});
                     //Clear downloads and reset count
                     setTimeout(() => {
                        console.log("Deleting duplicates and unconfirmed");
                        //Delete duplicates
                        deleteDuplicates();
                        deleteUnconfirmed();
                        setTimeout(() => {
                           console.log("Resetting download count")
                           //Reset download count
                           resetCount();
                           setTimeout(() => {
                              console.log("Closing export oage")
                              closeExportPage();
                           },2000);
                        },2000);
                     },2000);
                  };
               } else {
                  //Successful run
                  displayCount(true);
                  console.log(`Exports retrieved. Resetting count and closing site`);
                  setTimeout(() => {
                     resetCount();
                     setTimeout(() => {
                        console.log(`Closing export page`)
                        closeExportPage();
                     },2000);
                  },1000);
               };
            });
         },2000);
      break;
      }; //End switch
   }
);
//Listen for URL changes on the tabs (Errors)
chrome.tabs.onUpdated.addListener(function(tabId,changeInfo,tabInfo){
   if(running){
      console.log(`tabId ${tabId} was updated`);
      console.log(changeInfo);
      if(tabId === siteId && changeInfo.url){
         if(changeInfo.url.includes("/wp-content/")){
            console.log(`An error occured while downloading\nReloading export page`);
            displayProcess("An error occured while fetching. Re-downloading...");
            setTimeout(() => {
               chrome.tabs.remove(siteId,function(){
                  openExportPage();
               });
            },1000);
         }else if(changeInfo.url.includes("inbcu.com/login/")){
            displayProcess("You are not logged into NBCU SSO. Please login and try again");
            running = false;
            launcherPort.disconnect;
         };
      };
      if(tabId === launcherId && changeInfo.status === "loading"){
         console.log("Launcher reloaded. Disconnecting from launcher port");
         running = false;
         launcherPort.disconnect;
      };
   };
});
chrome.downloads.onChanged.addListener(function(download){
   if(running && download.filename.current){
      console.log(`Download ID ${download.id} was changed`)
      console.log(`Download name: ${download.filename.current}`);
   };
});