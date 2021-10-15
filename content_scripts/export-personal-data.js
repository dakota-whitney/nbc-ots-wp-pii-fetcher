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
    linkList.forEach((link,i) => {
        setTimeout(() => {
            link.click();
            if(i === linkList.length - 1){
                setTimeout(() => {
                    chrome.runtime.sendMessage({request: "count exports"},function(response){
                        console.log(`Background page status: ${response.status}`);
                    });
                },10000);
            };
        },i * 2000);
    });
};
function requestDownload(){
    if(linkList.length > 0){
        chrome.runtime.sendMessage({request: "download",userCount: linkList.length},function(response){
            if(response.command === "download"){
                stageAndDownload();
            };
        });
    }else{
        chrome.runtime.sendMessage({request: "no downloads"},function(response){
            console.log(`Background status: ${response.status}`);
        });
    };
};
//Send start message when body loads
document.body.onload = requestDownload();
//Listen for retries
chrome.runtime.onMessage.addListener(
    function(message, sender, sendResponse){
        if(message.command === "retry"){
            downloadExports();
            sendResponse({status: "re-downloading"});
        };
});