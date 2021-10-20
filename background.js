//Delcare global functions
function displayProcess(process){
   launcherPort.postMessage({command: "display",currentProcess: process});
};
function displayCount(successful){
   launcherPort.postMessage({command: "display",count: exportCount,wasSuccessful: successful});
};
function initializeExports(){
   chrome.downloads.search({query: ["wp-personal-data-file"],orderBy: ["-startTime"]},function(existingExports){
      console.log(`Found ${existingExports.length} existing exports to delete`);
      if(existingExports.length > 1000){
         displayProcess("Too many previous exports detected in download history. This can cause inaccurate export counts. Please delete any exports from your browser history and Downloads folder and try fetching again");
      }else if(existingExports.length > 0){
         displayProcess("Initializing download manager...");
         existingExports.forEach((existingExport,i) => {
            chrome.downloads.removeFile(existingExport.id,function(){
               chrome.downloads.erase({id: existingExport.id},function(){
                  console.log(`Existing export ${existingExport.id} deleted`);
                  if(i === existingExports.length - 1){
                     launcherPort.postMessage({command: "open"})
                  };
               });
            });
         });
      }else{
         launcherPort.postMessage({command: "open"})
      };
   });
};
function openExportPage(){
   chrome.tabs.create({windowId: launcherWindow,url: exportUrl,active: false},function(tab){
      siteId = tab.id;
      console.log(`Tab ID ${siteId} opened with URL ${exportUrl}\nListening for downloads`);
    });
 };
function dedupAndCount(){
   chrome.downloads.search({query: ["wp-personal-data-file","(",")"],orderBy: ["-startTime"]},function(duplicates){
      console.log(`Found ${duplicates.length} duplicates to delete`)
      if(duplicates.length > 0){
         displayProcess("Downloads complete. Deleting duplicates...");
         duplicates.forEach((duplicate,i) => {
            chrome.downloads.removeFile(duplicate.id,function(){
               chrome.downloads.erase({id: duplicate.id},function(){
                  console.log(`Duplicate ${duplicate.id} deleted`);
                  if(i === duplicates.length - 1){
                     countUnique();
                  };
               });
            });
         });
      }else{
         displayProcess("Downloads complete. Counting exports...");
         countUnique();
      };
   });
};
function countUnique(){
   chrome.downloads.search({query: ["wp-personal-data-file"],orderBy: ["-startTime"]},(exports) => {
      //Capture export count
      exportCount = exports.length;
      console.log(`Found ${exportCount} unique exports`);
      //Failed run
      if(exportCount < users.length){
         displayCount(false);
         deleteUnconfirmed();
         //If under retry limit
         if(retries < 3){
            retries++;
            displayProcess(`Re-downloading ${retries} time(s)...`);
            console.log("Sending retry command to export page");
            chrome.tabs.sendMessage(siteId,{command: "retry"},function(response){
               console.log(`Export page status: ${response.status}`);
            });
         }else{ //Retry limit reached
            displayProcess(`Too many retries on ${/\/telemundo\/|\/qa\//.test(exportUrl) ? exportUrl.split("/")[2] + "/" + `${exportUrl.split("/")[3]}` : `${exportUrl.split("/")[2]}`}. Marking incomplete`);
            console.log(`Retry limit reached on tab ${siteId}. Updating launcher page`);
            launcherPort.postMessage({command: "incomplete"});
            //Clear downloads and reset count
            setTimeout(() => {console.log("Resetting download count");resetAndClose();},1000);
         };
      }else{
         //Successful run
         displayCount(true);
         displayProcess("Exports retrieved");
         deleteUnconfirmed();
         console.log(`Exports retrieved. Resetting export count`);
         setTimeout(() => {console.log("Resetting download count");resetAndClose();},1000);
      };
   });
};
function resetAndClose(){
   exportCount = 0;
   retries = 0;
   errorCount = 0;
   chrome.downloads.erase({query: ["wp-personal-data-file"],orderBy: ["-startTime"]},function(erased){
      console.log(`Found ${erased.length} exports to erase from history`);
      if(erased.length > 0){
         displayProcess("Clearing download history...");
         erased.forEach((erasedItem,i) => {
            console.log(`Export ${erasedItem.id} erased from history`);
            if(i === erased.length - 1){
               closeExportPage();
            };
         });
      }else{
         closeExportPage();
      };
   });
};
function closeExportPage(){
   displayProcess("Closing site");
   chrome.tabs.remove(siteId,function(){
      console.log(`Tab ${siteId} closed. Opening next site`);
      launcherPort.postMessage({command: "open"});
   });
};
function deleteUnconfirmed(){
   chrome.downloads.search({query: ["Unconfirmed",".crdownload"],orderBy: ["-startTime"]},function(unconfirmed){
      console.log(`Found ${unconfirmed.length} unconfirmed downloads to delete`)
      unconfirmed.forEach((file) => {
         chrome.downloads.removeFile(file.id,function(){
            chrome.downloads.erase({id: file.id},function(){
               console.log(`Unconfirmed download ${file.id} deleted`);
            });
         });
      });
   });
};
//Initialize global variables
let launcherPort = 0;
let launcherWindow = 0;
let launcherId = 0;
let running = false;
let siteId = 0;
let exportUrl = "";
let users = [];
let exportCount = 0;
let retries = 0;
let errorCount = 0;
chrome.browserAction.onClicked.addListener(function(tab){
   if(/wp-admin\/my-sites\.php|wp-admin\/network\/sites\.php/.test(tab.url)){
      running = window.confirm(`Please confirm the following before fetching exports:\n\n- You are logged into ${tab.url.includes("microsites") ? `SSO on all Microsites` : `NBCU SSO`} in your current browser session\n\n- You've deleted any existing exports from your Downloads folder\n\n- You've allowed your browser to download multiple files on all ${tab.url.includes("microsites") ? `Microsites` : `Sites`}`);
      if(running){
         chrome.windows.getCurrent(function(window){
            launcherWindow = window.id;
         });
         launcherId = tab.id;
         console.log(`Launcher ID: ${launcherId}`)
         chrome.tabs.sendMessage(launcherId,{command: "initialize"},function(response){
            if(response.request === "initialize"){
               console.log("Launcher page rendered display\nInitializing exports");
               initializeExports();
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
            exportUrl = message.exportUrl;
            displayProcess("Opening next site...");
            openExportPage();
         break;
         case "complete":
            console.log("Received complete request from launcher");
            if(message.incomplete.length > 0){
               window.alert(`Some sites didn't finish. Please note the incomplete sites below\n:${message.incomplete.join("\n")}`);
               console.log(`Some sites didn't finish. Please note the incomplete sites below:\n${message.incomplete.join("\n")}`);
            };
            launcherPort.postMessage({command: "log users",users: users});
            running = false;
            launcherPort.disconnect();
         break;
      };
   });
});
chrome.runtime.onMessage.addListener(
   function(message,sender,sendResponse){
      if(running){
         switch(message.request){
            case "display no exports":
               console.log(`No export links detected on site ${exportUrl.split("/")[2]}`);
               sendResponse({status: "displaying no exports"});
               displayProcess(`No data requests detected on site ${/\/telemundo\/|\/qa\//.test(exportUrl) ? exportUrl.split("/")[2] + "/" + `${exportUrl.split("/")[3]}` : `${exportUrl.split("/")[2]}`}`);
            break;
            case "download":
               users = message.users;
               console.log(`Export page has fully loaded\nDetected ${users.length} download requests on export page`);
               displayProcess(`${users.length} data requests detected. Fetching exports...`);
               if(errorCount > 0){
                  sendResponse({command: "retry"});
               }else{
                  sendResponse({command: "download"});
               };
         break;
         case "count exports":
            sendResponse({status: "counting"});
            console.log(`Received count request from export page\nUser count is ${users.length}\nDeleting duplicates and counting`);
            dedupAndCount();
         break;
      };
   };
});
//Listen for URL changes (errors) on the export pages
chrome.tabs.onUpdated.addListener(function(tabId,changeInfo,tabInfo){
   if(running){
      console.log(`tab ${tabId} was updated`);
      console.log(changeInfo);
      if(tabId === siteId && changeInfo.url){
         if(changeInfo.url.includes("/wp-content/")){
            errorCount++;
            if(errorCount < 5){
               console.log(`An error occured while fetching\nReloading export page`);
               displayProcess("An error occured while fetching. Reloading export page...");
               setTimeout(() => {chrome.tabs.remove(siteId,function(){openExportPage();});},1000);
            }else{
               displayProcess(`Too many errors on ${/\/telemundo\/|\/qa\//.test(exportUrl) ? exportUrl.split("/")[2] + "/" + `${exportUrl.split("/")[3]}` : `${exportUrl.split("/")[2]}`}. Marking incomplete`)
               console.log(`Too many errors on tab ${siteId}. Flagging this site as incomplete`);
               launcherPort.postMessage({command: "incomplete"});
               //Clear downloads and reset count
               setTimeout(() => {console.log("Resetting download count");resetAndClose();},1000);
            };
         }else if(changeInfo.url.includes("inbcu.com/login/") || changeInfo.url.includes("/wp-login.php?")){
            console.log(`Alerting user to log into SSO and continue downloads`);
            window.alert(`You are not logged into SSO on site ${/\/telemundo\/|\/qa\//.test(exportUrl) ? exportUrl.split("/")[2] + "/" + `${exportUrl.split("/")[3]}` : `${exportUrl.split("/")[2]}`}. Please log into SSO to continue fetching`);
         };
      };
      if(tabId === launcherId && changeInfo.status === "loading"){
         console.log(`Launcher reloaded. Disconnecting from launcher port`);
         running = false;
         launcherPort.disconnect();
      };
   };
});
//Listen for download changes
chrome.downloads.onChanged.addListener(function(download){
   if(running){
      console.log(`Download ID ${download.id} was changed`)
      console.log(download);
   };
});