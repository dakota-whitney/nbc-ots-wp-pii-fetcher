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
                    chrome.runtime.sendMessage({status: "downloaded",listLength: linkList.length});
                },11000);
            };
        },i * 2000);
    });
};
//Stage and download exports on first run
document.onload = stageAndDownload();
//Listen for retries
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse){
        if(request.command === "retry"){
            downloadExports();
            sendResponse({status: "retrying downloads"});
        };
});