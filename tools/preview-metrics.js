/* Local QA only; writes browser measurements to DOM attributes for read-only inspection. */
(function(){
 var root=document.documentElement,total=0;
 if(!('PerformanceObserver' in window))return;
 root.dataset.qaCls='0';
 try{new PerformanceObserver(function(list){list.getEntries().forEach(function(e){if(!e.hadRecentInput){total+=e.value;root.dataset.qaCls=String(total);}});}).observe({type:'layout-shift',buffered:true});}catch(_){}
 try{new PerformanceObserver(function(list){var entries=list.getEntries(),last=entries[entries.length-1];if(last)root.dataset.qaLcp=String(Math.round(last.startTime));}).observe({type:'largest-contentful-paint',buffered:true});}catch(_){}
 window.addEventListener('load',function(){root.dataset.qaLoad=String(Math.round(performance.now()));});
}());
