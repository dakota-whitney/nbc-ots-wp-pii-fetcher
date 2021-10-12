//Declare global variables/functions
let linkList = document.querySelectorAll('span.export-personal-data-idle > button');
function stageAndDownload(){
    linkList.forEach((link,i) => {
        setTimeout(() => {
            link.click();
        },i * 2000);
    });
    setTimeout(() => {downloadExports();},5000);
};
function downloadExports(){
    let clickCount = 0;
    linkList.forEach((link,i) => {
        setTimeout(() => {
            link.click();
            clickCount++;
            if(clickCount === linkList.length){
                setTimeout(() => {
                    chrome.runtime.sendMessage({request: "count exports",listLength: linkList.length});
                },11000);
            };
        },i * 2000);
    });
};
function requestDownload(){
    chrome.runtime.sendMessage({request: "download"},function(response){
        console.log(`Background response: ${response.status}`);
    });
};
//Send start message when body loads
document.body.onload = requestDownload();
//Listen for retries
chrome.runtime.onMessage.addListener(
    function(message, sender, sendResponse){
        if(message.command === "start downloads"){
            stageAndDownload();
            sendResponse({status: "downloading"});
        };
        if(message.command === "retry"){
            downloadExports();
            sendResponse({status: "retrying downloads"});
        };
});