function toNumber(value){
  if(value===null||value===undefined||value==="")return "";
  var number=Number(String(value).replace(",","."));
  return isNaN(number)?"":number;
}
function getSpreadsheet(){return SpreadsheetApp.getActiveSpreadsheet()}
function ensureEntriesSheet(){
  var sheet=getSpreadsheet().getSheetByName("Einträge");
  if(!sheet)sheet=getSpreadsheet().insertSheet("Einträge");
  var header=["Erfasst am","Zeitraum von","Zeitraum bis","Fahrer","Maschine","Stundenzähler Beginn","Stundenzähler Ende","Maschinenstunden","Maschinen-Stundensatz","Maschinenkosten","Arbeitszeit Fahrer Stunden","Diesel Liter","Einsatzart","Bemerkung","Lieferschein Nummer","Kunde","Kundenadresse","Kundenort","Kundenkontakt"];
  if(sheet.getLastRow()===0){sheet.appendRow(header)}else{sheet.getRange(1,1,1,header.length).setValues([header])}
  sheet.setFrozenRows(1);
  return sheet;
}
function ensureMachinesSheet(){
  var sheet=getSpreadsheet().getSheetByName("Maschinen");
  if(!sheet)sheet=getSpreadsheet().insertSheet("Maschinen");
  var header=["Maschine","Stundensatz","Aktiv"];
  if(sheet.getLastRow()===0){sheet.appendRow(header)}else{sheet.getRange(1,1,1,header.length).setValues([header])}
  sheet.setFrozenRows(1);
  return sheet;
}
function ensureSummarySheet(){
  var sheet=getSpreadsheet().getSheetByName("Auswertung");
  if(!sheet)sheet=getSpreadsheet().insertSheet("Auswertung");
  sheet.clear();
  sheet.getRange("A1").setValue("Auswertung Maschinen-App").setFontWeight("bold").setFontSize(16);
  sheet.getRange("A3").setValue("Übersicht pro Maschine").setFontWeight("bold");
  sheet.getRange("A4").setFormula('=QUERY(Einträge!A:S;"select E, sum(H), sum(J), sum(L) where E is not null group by E label E \'Maschine\', sum(H) \'Maschinenstunden\', sum(J) \'Maschinenkosten\', sum(L) \'Diesel Liter\'";1)');
  sheet.getRange("A15").setValue("Übersicht pro Fahrer").setFontWeight("bold");
  sheet.getRange("A16").setFormula('=QUERY(Einträge!A:S;"select D, sum(H), sum(K), sum(J) where D is not null group by D label D \'Fahrer\', sum(H) \'Maschinenstunden\', sum(K) \'Fahrer-Arbeitszeit\', sum(J) \'Maschinenkosten\'";1)');
  sheet.getRange("A28").setValue("Übersicht pro Kunde").setFontWeight("bold");
  sheet.getRange("A29").setFormula('=QUERY(Einträge!A:S;"select P, sum(H), sum(J) where P is not null group by P label P \'Kunde\', sum(H) \'Maschinenstunden\', sum(J) \'Maschinenkosten\'";1)');
}
function setupSheets(){ensureEntriesSheet();ensureMachinesSheet();ensureSummarySheet()}
function makeDeliveryNoteNumber(){
  var year=new Date().getFullYear();
  var sheet=ensureEntriesSheet();
  var lastRow=sheet.getLastRow();
  var count=0;
  if(lastRow>=2){
    var values=sheet.getRange(2,15,lastRow-1,1).getValues();
    values.forEach(function(row){if(String(row[0]||"").indexOf("LS-"+year+"-")===0)count++});
  }
  return "LS-"+year+"-"+String(count+1).padStart(4,"0");
}
function getLastDeliveryNoteNumber(){
  var sheet=ensureEntriesSheet();
  var lastRow=sheet.getLastRow();
  if(lastRow<2)return"";
  return sheet.getRange(lastRow,15).getValue();
}
function getMachines(){
  var sheet=ensureMachinesSheet();
  var lastRow=sheet.getLastRow();
  if(lastRow<2)return[];
  var values=sheet.getRange(2,1,lastRow-1,3).getValues();
  var list=[];
  values.forEach(function(row){
    var name=String(row[0]||"").trim();
    var rate=toNumber(row[1]);
    var active=String(row[2]||"Ja").trim().toLowerCase();
    if(name&&active!=="nein"&&active!=="false"&&active!=="0")list.push({name:name,rate:rate===""?0:rate});
  });
  list.sort(function(a,b){return a.name.localeCompare(b.name)});
  return list;
}
function addMachine(name,rate){
  var sheet=ensureMachinesSheet();
  var machine=String(name||"").trim();
  if(!machine)return;
  var list=getMachines();
  for(var i=0;i<list.length;i++){if(list[i].name===machine)return}
  var machineRate=toNumber(rate);
  if(machineRate==="")machineRate=0;
  sheet.appendRow([machine,machineRate,"Ja"]);
  ensureSummarySheet();
}
function deleteMachine(name){
  var sheet=ensureMachinesSheet();
  var machine=String(name||"").trim();
  var lastRow=sheet.getLastRow();
  if(!machine||lastRow<2)return;
  for(var row=2;row<=lastRow;row++){
    if(String(sheet.getRange(row,1).getValue()).trim()===machine){
      sheet.getRange(row,3).setValue("Nein");
      ensureSummarySheet();
      return;
    }
  }
}
function findLastEndeForMachine(machine){
  var sheet=ensureEntriesSheet();
  var lastRow=sheet.getLastRow();
  if(lastRow<2)return"";
  for(var row=lastRow;row>=2;row--){
    var rowMachine=String(sheet.getRange(row,5).getValue()).trim();
    if(rowMachine===machine)return sheet.getRange(row,7).getValue();
  }
  return"";
}
function doPost(e){
  setupSheets();
  var data=JSON.parse(e.postData.contents);
  var action=data.action||"entry";
  if(action==="addMachine"){
    addMachine(data.maschine,data.stundensatz);
    return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
  }
  if(action==="deleteMachine"){
    deleteMachine(data.maschine);
    return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
  }
  var sheet=ensureEntriesSheet();
  var start=toNumber(data.stundenStart);
  var ende=toNumber(data.stundenEnde);
  var gefahreneStunden="";
  if(start!==""&&ende!==""){
    gefahreneStunden=Math.round((ende-start)*100)/100;
    if(gefahreneStunden<0)gefahreneStunden=0;
  }
  var rate=toNumber(data.maschinenStundensatz);
  if(rate==="")rate=0;
  var cost="";
  if(gefahreneStunden!=="")cost=Math.round(gefahreneStunden*rate*100)/100;
  var driverHours=toNumber(data.fahrerArbeitszeitStunden);
  var diesel=toNumber(data.diesel);
  var lsNumber=makeDeliveryNoteNumber();
  var row=[
    new Date(),data.datumVon||"",data.datumBis||"",data.fahrer||"",data.maschine||"",
    start,ende,gefahreneStunden,rate,cost,driverHours,diesel,
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
  if(action==="machines")return ContentService.createTextOutput(JSON.stringify({ok:true,machines:getMachines()})).setMimeType(ContentService.MimeType.JSON);
  if(action==="last"){
    var machine=e.parameter.machine||"";
    return ContentService.createTextOutput(JSON.stringify({ok:true,lastEnde:findLastEndeForMachine(machine)})).setMimeType(ContentService.MimeType.JSON);
  }
  if(action==="lastDeliveryNote")return ContentService.createTextOutput(JSON.stringify({ok:true,lsNumber:getLastDeliveryNoteNumber()})).setMimeType(ContentService.MimeType.JSON);
  if(action==="setup")return ContentService.createTextOutput(JSON.stringify({ok:true,message:"Tabellen wurden eingerichtet."})).setMimeType(ContentService.MimeType.JSON);
  return ContentService.createTextOutput("Maschinen-App ist aktiv.").setMimeType(ContentService.MimeType.TEXT);
}
