function toNumber(value){
  if(value===null||value===undefined||value==="")return "";
  var number=Number(String(value).replace(",","."));
  return isNaN(number)?"":number;
}
function getSpreadsheet(){return SpreadsheetApp.getActiveSpreadsheet()}
function ensureEntriesSheet(){
  var sheet=getSpreadsheet().getSheetByName("Einträge");
  if(!sheet)sheet=getSpreadsheet().insertSheet("Einträge");
  var header=["Erfasst am","Zeitraum von","Zeitraum bis","Fahrer","Fahrer-Stundensatz","Fahrer-Kosten","Zugmaschine","Anbaugerät","Geräte-Kombination","Stundenzähler Beginn","Stundenzähler Ende","Stunden","Stundensatz Zugmaschine","Stundensatz Anbaugerät","Gesamt-Stundensatz Maschine","Maschinenkosten","Arbeitszeit Fahrer Stunden","Gesamtkosten","Diesel Liter","Einsatzart","Bemerkung","Lieferschein Nummer","Kunde","Kundenadresse","Kundenort","Kundenkontakt"];
  if(sheet.getLastRow()===0){sheet.appendRow(header)}else{sheet.getRange(1,1,1,header.length).setValues([header])}
  sheet.setFrozenRows(1);
  return sheet;
}
function ensureItemsSheet(){
  var sheet=getSpreadsheet().getSheetByName("Geräte");
  if(!sheet)sheet=getSpreadsheet().insertSheet("Geräte");
  var header=["Typ","Name","Stundensatz","Aktiv"];
  if(sheet.getLastRow()===0){sheet.appendRow(header)}else{sheet.getRange(1,1,1,header.length).setValues([header])}
  sheet.setFrozenRows(1);
  return sheet;
}
function ensureSummarySheet(){
  var sheet=getSpreadsheet().getSheetByName("Auswertung");
  if(!sheet)sheet=getSpreadsheet().insertSheet("Auswertung");
  sheet.clear();
  sheet.getRange("A1").setValue("Auswertung Maschinen-App").setFontWeight("bold").setFontSize(16);
  sheet.getRange("A3").setValue("Übersicht pro Zugmaschine").setFontWeight("bold");
  sheet.getRange("A4").setFormula('=QUERY(Einträge!A:Z;"select G, sum(L), sum(P), sum(S) where G is not null group by G label G \'Zugmaschine\', sum(L) \'Stunden\', sum(P) \'Maschinenkosten\', sum(S) \'Diesel Liter\'";1)');
  sheet.getRange("A15").setValue("Übersicht pro Anbaugerät").setFontWeight("bold");
  sheet.getRange("A16").setFormula('=QUERY(Einträge!A:Z;"select H, sum(L), sum(P) where H is not null group by H label H \'Anbaugerät\', sum(L) \'Stunden\', sum(P) \'Maschinenkosten\'";1)');
  sheet.getRange("A28").setValue("Übersicht pro Fahrer").setFontWeight("bold");
  sheet.getRange("A29").setFormula('=QUERY(Einträge!A:Z;"select D, sum(L), sum(Q), sum(F), sum(R) where D is not null group by D label D \'Fahrer\', sum(L) \'Maschinenstunden\', sum(Q) \'Fahrer-Arbeitszeit\', sum(F) \'Fahrerkosten\', sum(R) \'Gesamtkosten\'";1)');
  sheet.getRange("A42").setValue("Übersicht pro Kunde").setFontWeight("bold");
  sheet.getRange("A43").setFormula('=QUERY(Einträge!A:Z;"select W, sum(L), sum(P), sum(F), sum(R) where W is not null group by W label W \'Kunde\', sum(L) \'Stunden\', sum(P) \'Maschinenkosten\', sum(F) \'Fahrerkosten\', sum(R) \'Gesamtkosten\'";1)');
}
function setupSheets(){ensureEntriesSheet();ensureItemsSheet();ensureSummarySheet()}
function makeDeliveryNoteNumber(){
  var year=new Date().getFullYear();
  var sheet=ensureEntriesSheet();
  var lastRow=sheet.getLastRow();
  var count=0;
  if(lastRow>=2){
    var values=sheet.getRange(2,22,lastRow-1,1).getValues();
    values.forEach(function(row){if(String(row[0]||"").indexOf("LS-"+year+"-")===0)count++});
  }
  return "LS-"+year+"-"+String(count+1).padStart(4,"0");
}
function getLastDeliveryNoteNumber(){
  var sheet=ensureEntriesSheet();
  var lastRow=sheet.getLastRow();
  if(lastRow<2)return"";
  return sheet.getRange(lastRow,22).getValue();
}
function getItemsByType(type){
  var sheet=ensureItemsSheet();
  var lastRow=sheet.getLastRow();
  if(lastRow<2)return[];
  var values=sheet.getRange(2,1,lastRow-1,4).getValues();
  var list=[];
  values.forEach(function(row){
    var typ=String(row[0]||"").trim();
    var name=String(row[1]||"").trim();
    var rate=toNumber(row[2]);
    var active=String(row[3]||"Ja").trim().toLowerCase();
    if(typ===type&&name&&active!=="nein"&&active!=="false"&&active!=="0")list.push({name:name,rate:rate===""?0:rate});
  });
  list.sort(function(a,b){return a.name.localeCompare(b.name)});
  return list;
}
function addMachine(type,name,rate){
  var sheet=ensureItemsSheet();
  var itemType=String(type||"").trim();
  var itemName=String(name||"").trim();
  if(!itemType||!itemName)return;
  var list=getItemsByType(itemType);
  for(var i=0;i<list.length;i++){if(list[i].name===itemName)return}
  var itemRate=toNumber(rate);
  if(itemRate==="")itemRate=0;
  sheet.appendRow([itemType,itemName,itemRate,"Ja"]);
  ensureSummarySheet();
}
function deleteMachine(type,name){
  var sheet=ensureItemsSheet();
  var itemType=String(type||"").trim();
  var itemName=String(name||"").trim();
  var lastRow=sheet.getLastRow();
  if(!itemType||!itemName||lastRow<2)return;
  for(var row=2;row<=lastRow;row++){
    if(String(sheet.getRange(row,1).getValue()).trim()===itemType&&String(sheet.getRange(row,2).getValue()).trim()===itemName){
      sheet.getRange(row,4).setValue("Nein");
      ensureSummarySheet();
      return;
    }
  }
}
function findLastEndeForZugmaschine(zugmaschine){
  var sheet=ensureEntriesSheet();
  var lastRow=sheet.getLastRow();
  if(lastRow<2)return"";
  for(var row=lastRow;row>=2;row--){
    var rowMachine=String(sheet.getRange(row,7).getValue()).trim();
    if(rowMachine===zugmaschine)return sheet.getRange(row,11).getValue();
  }
  return"";
}
function doPost(e){
  setupSheets();
  var data=JSON.parse(e.postData.contents);
  var action=data.action||"entry";
  if(action==="addMachine"){
    addMachine(data.typ,data.name||data.maschine,data.stundensatz);
    return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
  }
  if(action==="deleteMachine"){
    deleteMachine(data.typ,data.name||data.maschine);
    return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
  }
  var sheet=ensureEntriesSheet();
  var start=toNumber(data.stundenStart);
  var ende=toNumber(data.stundenEnde);
  var hours="";
  if(start!==""&&ende!==""){
    hours=Math.round((ende-start)*100)/100;
    if(hours<0)hours=0;
  }
  var driverRate=toNumber(data.fahrerStundensatz); if(driverRate==="")driverRate=0;
  var driverHours=toNumber(data.fahrerArbeitszeitStunden); if(driverHours==="")driverHours=0;
  var driverCost=Math.round(driverRate*driverHours*100)/100;
  var rateZug=toNumber(data.stundensatzZugmaschine); if(rateZug==="")rateZug=0;
  var rateAnbau=toNumber(data.stundensatzAnbaugeraet); if(rateAnbau==="")rateAnbau=0;
  var totalRate=toNumber(data.maschinenStundensatz); if(totalRate==="")totalRate=rateZug+rateAnbau;
  var machineCost="";
  if(hours!=="")machineCost=Math.round(hours*totalRate*100)/100;
  var totalCost="";
  if(machineCost!=="")totalCost=Math.round((machineCost+driverCost)*100)/100;
  var lsNumber=makeDeliveryNoteNumber();
  var row=[
    new Date(),data.datumVon||"",data.datumBis||"",
    data.fahrer||"",driverRate,driverCost,
    data.zugmaschine||"",data.anbaugeraet||"",data.geraetKombination||"",
    start,ende,hours,rateZug,rateAnbau,totalRate,machineCost,
    driverHours,totalCost,toNumber(data.diesel),
    data.einsatzart==="ueberbetrieblich"?"überbetrieblich":"innerbetrieblich",
    data.bemerkung||"",lsNumber,data.kundeName||"",data.kundeAdresse||"",data.kundeOrt||"",data.kundeKontakt||""
  ];
  sheet.appendRow(row);
  ensureSummarySheet();
  return ContentService.createTextOutput(JSON.stringify({ok:true,lsNumber:lsNumber})).setMimeType(ContentService.MimeType.JSON);
}
function doGet(e){
  setupSheets();
  var action=e&&e.parameter?e.parameter.action:"";
  if(action==="machines"){
    return ContentService.createTextOutput(JSON.stringify({ok:true,zugmaschinen:getItemsByType("zugmaschine"),anbaugeraete:getItemsByType("anbaugeraet")})).setMimeType(ContentService.MimeType.JSON);
  }
  if(action==="last"){
    var zugmaschine=e.parameter.zugmaschine||e.parameter.machine||"";
    return ContentService.createTextOutput(JSON.stringify({ok:true,lastEnde:findLastEndeForZugmaschine(zugmaschine)})).setMimeType(ContentService.MimeType.JSON);
  }
  if(action==="lastDeliveryNote")return ContentService.createTextOutput(JSON.stringify({ok:true,lsNumber:getLastDeliveryNoteNumber()})).setMimeType(ContentService.MimeType.JSON);
  if(action==="setup")return ContentService.createTextOutput(JSON.stringify({ok:true,message:"Tabellen wurden eingerichtet."})).setMimeType(ContentService.MimeType.JSON);
  return ContentService.createTextOutput("Maschinen-App ist aktiv.").setMimeType(ContentService.MimeType.TEXT);
}
