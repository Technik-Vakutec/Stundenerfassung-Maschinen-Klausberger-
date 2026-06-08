import React,{useEffect,useMemo,useState}from"react";

const APP_NAME="Maschinen";
const SHEET_WEBAPP_URL=import.meta.env.VITE_GOOGLE_SCRIPT_URL||"";

const DIENSTLEISTER={
  name:"Max Mustermann",
  adresse:"Musterstraße 1",
  ort:"1234 Musterstadt",
  telefon:"0664 / 12345678",
  email:"office@muster.at"
};

function parseDecimal(value){
  if(value===null||value===undefined)return NaN;
  const cleaned=String(value).trim().replace(/\s/g,"").replace(",",".");
  if(cleaned==="")return NaN;
  return Number(cleaned);
}
function formatHours(value){
  if(value===""||Number.isNaN(value)||value===null||value===undefined)return"—";
  return Number(value).toLocaleString("de-AT",{minimumFractionDigits:1,maximumFractionDigits:2})+" h";
}
function formatEuro(value){
  if(value===""||Number.isNaN(value)||value===null||value===undefined)return"—";
  return "€ "+Number(value).toLocaleString("de-AT",{minimumFractionDigits:2,maximumFractionDigits:2});
}
function pad2(value){return String(value).padStart(2,"0")}
function secondsToClock(totalSeconds){
  const seconds=Math.max(0,Math.floor(totalSeconds||0));
  const h=Math.floor(seconds/3600);
  const m=Math.floor((seconds%3600)/60);
  const s=seconds%60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}
function htmlEscape(value){
  return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
function Field({label,children}){return <label className="field"><span>{label}</span>{children}</label>}

export default function App(){
  const today=new Date().toISOString().slice(0,10);

  const[form,setForm]=useState({
    datumVon:today,
    datumBis:today,
    fahrer:"",
    fahrerStundensatz:"",
    zugmaschine:"",
    anbaugeraet:"",
    stundenStart:"",
    stundenEnde:"",
    diesel:"",
    einsatzart:"innerbetrieblich",
    arbeitszeitStunden:"",
    kundeName:"",
    kundeAdresse:"",
    kundeOrt:"",
    kundeKontakt:"",
    bemerkung:""
  });

  const[zugmaschinen,setZugmaschinen]=useState([]);
  const[anbaugeraete,setAnbaugeraete]=useState([]);
  const[newZugmaschine,setNewZugmaschine]=useState("");
  const[newZugRate,setNewZugRate]=useState("");
  const[newAnbaugeraet,setNewAnbaugeraet]=useState("");
  const[newAnbauRate,setNewAnbauRate]=useState("");
  const[message,setMessage]=useState("");
  const[sending,setSending]=useState(false);
  const[loading,setLoading]=useState(false);
  const[showManage,setShowManage]=useState(false);
  const[stopwatchSeconds,setStopwatchSeconds]=useState(0);
  const[stopwatchRunning,setStopwatchRunning]=useState(false);
  const[lastDeliveryNote,setLastDeliveryNote]=useState(null);

  useEffect(()=>{loadMachines()},[]);

  useEffect(()=>{
    if(!stopwatchRunning)return;
    const timer=setInterval(()=>setStopwatchSeconds(current=>current+1),1000);
    return()=>clearInterval(timer);
  },[stopwatchRunning]);

  const selectedZugmaschine=zugmaschinen.find(item=>item.name===form.zugmaschine);
  const selectedAnbaugeraet=anbaugeraete.find(item=>item.name===form.anbaugeraet);

  const zugRate=selectedZugmaschine?Number(selectedZugmaschine.rate||0):0;
  const anbauRate=selectedAnbaugeraet?Number(selectedAnbaugeraet.rate||0):0;
  const combinedRate=zugRate+anbauRate;

  const equipmentName=[form.zugmaschine,form.anbaugeraet].filter(Boolean).join(" + ");

  const startNumber=parseDecimal(form.stundenStart);
  const endNumber=parseDecimal(form.stundenEnde);
  const dieselNumber=parseDecimal(form.diesel);
  const manualDriverHours=parseDecimal(form.arbeitszeitStunden);
  const driverRateNumber=parseDecimal(form.fahrerStundensatz);

  const gefahreneStunden=useMemo(()=>{
    const start=parseDecimal(form.stundenStart);
    const ende=parseDecimal(form.stundenEnde);
    if(Number.isNaN(start)||Number.isNaN(ende))return"";
    return Math.round((ende-start)*100)/100;
  },[form.stundenStart,form.stundenEnde]);

  const hasValidHours=gefahreneStunden!==""&&gefahreneStunden>=0;
  const machineCost=hasValidHours?Math.round(Number(gefahreneStunden)*combinedRate*100)/100:"";
  const driverHoursFromStopwatch=Math.round((stopwatchSeconds/3600)*100)/100;
  const driverHours=!Number.isNaN(manualDriverHours)?manualDriverHours:driverHoursFromStopwatch;
  const driverRate=Number.isNaN(driverRateNumber)?0:driverRateNumber;
  const driverCost=Math.round(driverHours*driverRate*100)/100;
  const totalCost=(machineCost===""?"":Math.round((Number(machineCost)+driverCost)*100)/100);

  const canSave=
    form.datumVon&&
    form.datumBis&&
    form.fahrer.trim()&&
    form.zugmaschine&&
    form.kundeName.trim()&&
    !Number.isNaN(startNumber)&&
    !Number.isNaN(endNumber)&&
    hasValidHours&&
    !sending;

  async function apiGet(action,extra=""){
    const response=await fetch(`${SHEET_WEBAPP_URL}?action=${action}${extra}&ts=${Date.now()}`);
    return await response.json();
  }

  async function apiPost(payload){
    await fetch(SHEET_WEBAPP_URL,{
      method:"POST",
      mode:"no-cors",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify(payload)
    });
  }

  async function loadMachines(){
    setMessage("");
    if(!SHEET_WEBAPP_URL){
      setMessage("Google-Script-Link fehlt noch. Bitte VITE_GOOGLE_SCRIPT_URL in Vercel eintragen.");
      return;
    }
    setLoading(true);
    try{
      const data=await apiGet("machines");
      const z=Array.isArray(data.zugmaschinen)?data.zugmaschinen:[];
      const a=Array.isArray(data.anbaugeraete)?data.anbaugeraete:[];
      setZugmaschinen(z.map(item=>({name:String(item.name||"").trim(),rate:Number(item.rate||0)})).filter(item=>item.name));
      setAnbaugeraete(a.map(item=>({name:String(item.name||"").trim(),rate:Number(item.rate||0)})).filter(item=>item.name));
    }catch{
      setMessage("Maschinen konnten nicht geladen werden. Bitte Google-Script prüfen.");
    }finally{
      setLoading(false);
    }
  }

  async function takeLastValue(){
    setMessage("");
    if(!SHEET_WEBAPP_URL){setMessage("Google-Script-Link fehlt noch.");return}
    if(!form.zugmaschine){alert("Bitte zuerst eine Zugmaschine auswählen.");return}
    setLoading(true);
    try{
      const data=await apiGet("last",`&zugmaschine=${encodeURIComponent(form.zugmaschine)}`);
      if(!data.ok||data.lastEnde===""||data.lastEnde===null||data.lastEnde===undefined){
        setMessage(`Für ${form.zugmaschine} wurde noch kein letzter Stundenzähler gefunden.`);
        return;
      }
      const last=String(data.lastEnde).replace(".",",");
      setForm(current=>({...current,stundenStart:last}));
      setMessage(`Letzter Stundenzähler für ${form.zugmaschine} übernommen: ${last}`);
    }catch{
      setMessage("Letzter Wert konnte nicht geladen werden.");
    }finally{
      setLoading(false);
    }
  }

  async function addZugmaschine(){
    const name=newZugmaschine.trim();
    const rate=parseDecimal(newZugRate);
    if(!name){alert("Bitte Namen der Zugmaschine eingeben.");return}
    if(Number.isNaN(rate)||rate<0){alert("Bitte einen gültigen Stundensatz eingeben.");return}
    if(zugmaschinen.some(item=>item.name===name)){alert("Diese Zugmaschine ist bereits vorhanden.");return}
    setLoading(true);
    try{
      await apiPost({action:"addMachine",typ:"zugmaschine",name,stundensatz:rate});
      const updated=[...zugmaschinen,{name,rate}].sort((a,b)=>a.name.localeCompare(b.name,"de"));
      setZugmaschinen(updated);
      setNewZugmaschine("");
      setNewZugRate("");
      setForm(current=>({...current,zugmaschine:name}));
      setMessage(`Zugmaschine hinzugefügt: ${name}`);
    }catch{
      setMessage("Zugmaschine konnte nicht hinzugefügt werden.");
    }finally{
      setLoading(false);
    }
  }

  async function addAnbaugeraet(){
    const name=newAnbaugeraet.trim();
    const rate=parseDecimal(newAnbauRate);
    if(!name){alert("Bitte Namen des Anbaugeräts eingeben.");return}
    if(Number.isNaN(rate)||rate<0){alert("Bitte einen gültigen Stundensatz eingeben.");return}
    if(anbaugeraete.some(item=>item.name===name)){alert("Dieses Anbaugerät ist bereits vorhanden.");return}
    setLoading(true);
    try{
      await apiPost({action:"addMachine",typ:"anbaugeraet",name,stundensatz:rate});
      const updated=[...anbaugeraete,{name,rate}].sort((a,b)=>a.name.localeCompare(b.name,"de"));
      setAnbaugeraete(updated);
      setNewAnbaugeraet("");
      setNewAnbauRate("");
      setForm(current=>({...current,anbaugeraet:name}));
      setMessage(`Anbaugerät hinzugefügt: ${name}`);
    }catch{
      setMessage("Anbaugerät konnte nicht hinzugefügt werden.");
    }finally{
      setLoading(false);
    }
  }

  async function deleteItem(typ,name){
    if(!confirm(`Wirklich löschen/deaktivieren?\n\n${name}`))return;
    setLoading(true);
    try{
      await apiPost({action:"deleteMachine",typ,name});
      if(typ==="zugmaschine"){
        const updated=zugmaschinen.filter(item=>item.name!==name);
        setZugmaschinen(updated);
        if(form.zugmaschine===name)setForm(current=>({...current,zugmaschine:updated[0]?.name||""}));
      }else{
        const updated=anbaugeraete.filter(item=>item.name!==name);
        setAnbaugeraete(updated);
        if(form.anbaugeraet===name)setForm(current=>({...current,anbaugeraet:""}));
      }
      setMessage(`Gelöscht: ${name}`);
    }catch{
      setMessage("Löschen fehlgeschlagen.");
    }finally{
      setLoading(false);
    }
  }

  function useStopwatchAsWorkTime(){
    const hours=Math.round((stopwatchSeconds/3600)*100)/100;
    setForm(current=>({...current,arbeitszeitStunden:String(hours).replace(".",",")}));
  }

  function resetStopwatch(){
    setStopwatchRunning(false);
    setStopwatchSeconds(0);
  }

  function buildDeliveryNoteData(lsNumber="VORANSICHT"){
    return {
      lsNumber,
      datum:new Date().toLocaleDateString("de-AT"),
      dienstleister:DIENSTLEISTER,
      kunde:{
        name:form.kundeName.trim(),
        adresse:form.kundeAdresse.trim(),
        ort:form.kundeOrt.trim(),
        kontakt:form.kundeKontakt.trim()
      },
      einsatz:{
        datumVon:form.datumVon,
        datumBis:form.datumBis,
        fahrer:form.fahrer.trim(),
        zugmaschine:form.zugmaschine,
        anbaugeraet:form.anbaugeraet,
        maschine:equipmentName,
        einsatzart:form.einsatzart==="ueberbetrieblich"?"überbetrieblich":"innerbetrieblich",
        stundenStart:startNumber,
        stundenEnde:endNumber,
        maschinenstunden:Number(gefahreneStunden),
        stundensatzZug:zugRate,
        stundensatzAnbau:anbauRate,
        stundensatz:combinedRate,
        maschinenkosten:machineCost,
        fahrerStundensatz:driverRate,
        fahrerArbeitszeit:Number.isNaN(driverHours)?0:driverHours,
        fahrerkosten:driverCost,
        gesamtkosten:totalCost,
        diesel:Number.isNaN(dieselNumber)?0:dieselNumber,
        bemerkung:form.bemerkung.trim()
      }
    };
  }

  function openDeliveryNote(data){
    const d=data;
    const html=`<!doctype html>
<html lang="de">
<head><meta charset="utf-8"/><title>${htmlEscape(d.lsNumber)} Lieferschein</title>
<style>
body{font-family:Arial,sans-serif;color:#111827;margin:0;padding:32px;background:#fff}.page{max-width:850px;margin:0 auto}.top{display:flex;justify-content:space-between;gap:30px;border-bottom:3px solid #111827;padding-bottom:18px}h1{font-size:34px;margin:0 0 8px;letter-spacing:.04em}h2{font-size:16px;margin:28px 0 8px;border-bottom:1px solid #d1d5db;padding-bottom:6px}p{margin:3px 0;line-height:1.35}.muted{color:#6b7280}.box{border:1px solid #d1d5db;border-radius:10px;padding:14px;margin-top:10px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #d1d5db;padding:10px;text-align:left;font-size:14px}th{background:#f3f4f6}.right{text-align:right}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:70px}.line{border-top:1px solid #111827;padding-top:8px;text-align:center}@media print{body{padding:0}.page{max-width:none}.no-print{display:none}}
</style></head>
<body><div class="page">
<div class="top"><div><h1>LIEFERSCHEIN</h1><p><strong>Nr.:</strong> ${htmlEscape(d.lsNumber)}</p><p><strong>Datum:</strong> ${htmlEscape(d.datum)}</p></div><div><p><strong>${htmlEscape(d.dienstleister.name)}</strong></p><p>${htmlEscape(d.dienstleister.adresse)}</p><p>${htmlEscape(d.dienstleister.ort)}</p><p>${htmlEscape(d.dienstleister.telefon)}</p><p>${htmlEscape(d.dienstleister.email)}</p></div></div>
<h2>Kunde / Auftraggeber</h2><div class="box"><p><strong>${htmlEscape(d.kunde.name)}</strong></p><p>${htmlEscape(d.kunde.adresse)}</p><p>${htmlEscape(d.kunde.ort)}</p><p>${htmlEscape(d.kunde.kontakt)}</p></div>
<h2>Einsatzdaten</h2><p><strong>Zeitraum:</strong> ${htmlEscape(d.einsatz.datumVon)} bis ${htmlEscape(d.einsatz.datumBis)}</p><p><strong>Fahrer:</strong> ${htmlEscape(d.einsatz.fahrer)}</p><p><strong>Zugmaschine:</strong> ${htmlEscape(d.einsatz.zugmaschine)}</p><p><strong>Anbaugerät:</strong> ${htmlEscape(d.einsatz.anbaugeraet||"-")}</p><p><strong>Einsatzart:</strong> ${htmlEscape(d.einsatz.einsatzart)}</p>
<table><thead><tr><th>Position</th><th class="right">Menge</th><th>Einheit</th><th class="right">Stundensatz</th><th class="right">Gesamt</th></tr></thead><tbody>
<tr><td>${htmlEscape(d.einsatz.zugmaschine)}</td><td class="right">${htmlEscape(formatHours(d.einsatz.maschinenstunden))}</td><td>h</td><td class="right">${htmlEscape(formatEuro(d.einsatz.stundensatzZug))}</td><td class="right">${htmlEscape(formatEuro(d.einsatz.maschinenstunden*d.einsatz.stundensatzZug))}</td></tr>
${d.einsatz.anbaugeraet?`<tr><td>${htmlEscape(d.einsatz.anbaugeraet)}</td><td class="right">${htmlEscape(formatHours(d.einsatz.maschinenstunden))}</td><td>h</td><td class="right">${htmlEscape(formatEuro(d.einsatz.stundensatzAnbau))}</td><td class="right">${htmlEscape(formatEuro(d.einsatz.maschinenstunden*d.einsatz.stundensatzAnbau))}</td></tr>`:""}
<tr><td>Fahrer-Arbeitszeit</td><td class="right">${htmlEscape(formatHours(d.einsatz.fahrerArbeitszeit))}</td><td>h</td><td class="right">${htmlEscape(formatEuro(d.einsatz.fahrerStundensatz))}</td><td class="right">${htmlEscape(formatEuro(d.einsatz.fahrerkosten))}</td></tr>
<tr><td colspan="4" class="right"><strong>Gesamt</strong></td><td class="right"><strong>${htmlEscape(formatEuro(d.einsatz.gesamtkosten))}</strong></td></tr>
</tbody></table>
<h2>Weitere Angaben</h2><p><strong>Stundenzähler Beginn:</strong> ${htmlEscape(d.einsatz.stundenStart)}</p><p><strong>Stundenzähler Ende:</strong> ${htmlEscape(d.einsatz.stundenEnde)}</p><p><strong>Diesel:</strong> ${htmlEscape(d.einsatz.diesel)} Liter</p><p><strong>Bemerkung:</strong> ${htmlEscape(d.einsatz.bemerkung)}</p>
<div class="signatures"><div class="line">Unterschrift Kunde</div><div class="line">Unterschrift Fahrer</div></div>
<p class="muted no-print" style="margin-top:40px">Zum Speichern als PDF bitte Drucken öffnen und „Als PDF sichern“ wählen.</p>
</div><script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`;
    const win=window.open("","_blank");
    if(!win){alert("Popup wurde blockiert. Bitte Popups für diese Seite erlauben.");return}
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  function previewDeliveryNote(){
    if(!form.kundeName.trim()){alert("Bitte zuerst den Kunden eingeben.");return}
    if(!form.zugmaschine||!form.fahrer.trim()){alert("Bitte Zugmaschine und Fahrer ausfüllen.");return}
    if(!hasValidHours){alert("Bitte gültige Betriebsstunden eingeben.");return}
    openDeliveryNote(buildDeliveryNoteData());
  }

  async function saveEntry(event){
    event.preventDefault();
    setMessage("");
    setLastDeliveryNote(null);
    if(!SHEET_WEBAPP_URL){setMessage("Google-Script-Link fehlt noch.");return}
    if(!canSave){alert("Bitte alle Pflichtfelder richtig ausfüllen.");return}
    setSending(true);
    const previewData=buildDeliveryNoteData();
    const payload={
      action:"entry",
      datumVon:form.datumVon,
      datumBis:form.datumBis,
      fahrer:form.fahrer.trim(),
      fahrerStundensatz:driverRate,
      fahrerkosten:driverCost,
      zugmaschine:form.zugmaschine,
      anbaugeraet:form.anbaugeraet,
      geraetKombination:equipmentName,
      stundensatzZugmaschine:zugRate,
      stundensatzAnbaugeraet:anbauRate,
      maschinenStundensatz:combinedRate,
      maschinenKosten:machineCost,
      gesamtkosten:totalCost,
      stundenStart:startNumber,
      stundenEnde:endNumber,
      betriebsstunden:Number(gefahreneStunden),
      fahrerArbeitszeitStunden:Number.isNaN(driverHours)?0:driverHours,
      diesel:Number.isNaN(dieselNumber)?0:dieselNumber,
      einsatzart:form.einsatzart,
      kundeName:form.kundeName.trim(),
      kundeAdresse:form.kundeAdresse.trim(),
      kundeOrt:form.kundeOrt.trim(),
      kundeKontakt:form.kundeKontakt.trim(),
      bemerkung:form.bemerkung.trim(),
      erfasstAm:new Date().toISOString()
    };
    try{
      await apiPost(payload);
      let lsNumber="LS-GESPEICHERT";
      try{
        const last=await apiGet("lastDeliveryNote");
        if(last.ok&&last.lsNumber)lsNumber=last.lsNumber;
      }catch{}
      setLastDeliveryNote({...previewData,lsNumber});
      setMessage("Eintrag wurde gespeichert. Der Lieferschein kann jetzt erstellt werden.");
      setForm({
        datumVon:today,
        datumBis:today,
        fahrer:"",
        fahrerStundensatz:"",
        zugmaschine:form.zugmaschine,
        anbaugeraet:form.anbaugeraet,
        stundenStart:"",
        stundenEnde:"",
        diesel:"",
        einsatzart:"innerbetrieblich",
        arbeitszeitStunden:"",
        kundeName:"",
        kundeAdresse:"",
        kundeOrt:"",
        kundeKontakt:"",
        bemerkung:""
      });
      resetStopwatch();
    }catch{
      setMessage("Speichern fehlgeschlagen. Bitte Internetverbindung prüfen.");
    }finally{
      setSending(false);
    }
  }

  return <div className="page"><main className="app-card">
    <header className="top">
      <div className="logo">🚜</div>
      <div className="header-text">
        <h1>{APP_NAME}</h1>
        <p>Betriebs- und Maschinenerfassung</p>
      </div>
    </header>

    {message&&<div className="message">{message}</div>}
    {lastDeliveryNote&&<div className="message action-message"><span>Lieferschein {lastDeliveryNote.lsNumber} bereit.</span><button type="button" className="secondary" onClick={()=>openDeliveryNote(lastDeliveryNote)}>Lieferschein PDF</button></div>}

    <form onSubmit={saveEntry} className="form">
      <section className="section">
        <div className="section-head">
          <h2>Maschinenkombination</h2>
          <button type="button" className="small-button" onClick={()=>setShowManage(!showManage)}>{showManage?"Schließen":"Geräte bearbeiten"}</button>
        </div>

        <Field label="Zugmaschine">
          <select value={form.zugmaschine} onChange={e=>setForm({...form,zugmaschine:e.target.value,stundenStart:""})}>
            <option value="">Bitte Zugmaschine auswählen</option>
            {zugmaschinen.map(item=><option key={item.name} value={item.name}>{item.name} — {formatEuro(item.rate)}/h</option>)}
          </select>
        </Field>

        <Field label="Anbaugerät">
          <select value={form.anbaugeraet} onChange={e=>setForm({...form,anbaugeraet:e.target.value})}>
            <option value="">Kein Anbaugerät</option>
            {anbaugeraete.map(item=><option key={item.name} value={item.name}>{item.name} — {formatEuro(item.rate)}/h</option>)}
          </select>
        </Field>

        <div className="info-box">Maschinen-Stundensatz gesamt: <strong>{formatEuro(combinedRate)} / Stunde</strong></div>

        {showManage&&<div className="manage-box">
          <h3>Zugmaschine hinzufügen</h3>
          <div className="add-row">
            <input type="text" placeholder="z. B. Traktor 1" value={newZugmaschine} onChange={e=>setNewZugmaschine(e.target.value)}/>
            <input type="text" inputMode="decimal" placeholder="€/h" value={newZugRate} onChange={e=>setNewZugRate(e.target.value)}/>
            <button type="button" className="secondary" onClick={addZugmaschine} disabled={loading}>Hinzufügen</button>
          </div>
          <div className="machine-list">
            {zugmaschinen.map(item=><div className="machine-item" key={item.name}><span>{item.name}<small>{formatEuro(item.rate)} / Stunde</small></span><button type="button" onClick={()=>deleteItem("zugmaschine",item.name)}>Löschen</button></div>)}
          </div>

          <h3>Anbaugerät hinzufügen</h3>
          <div className="add-row">
            <input type="text" placeholder="z. B. Mulcher" value={newAnbaugeraet} onChange={e=>setNewAnbaugeraet(e.target.value)}/>
            <input type="text" inputMode="decimal" placeholder="€/h" value={newAnbauRate} onChange={e=>setNewAnbauRate(e.target.value)}/>
            <button type="button" className="secondary" onClick={addAnbaugeraet} disabled={loading}>Hinzufügen</button>
          </div>
          <div className="machine-list">
            {anbaugeraete.map(item=><div className="machine-item" key={item.name}><span>{item.name}<small>{formatEuro(item.rate)} / Stunde</small></span><button type="button" onClick={()=>deleteItem("anbaugeraet",item.name)}>Löschen</button></div>)}
          </div>
        </div>}
      </section>

      <section className="section">
        <h2>Kunde / Auftraggeber</h2>
        <Field label="Kunde / Firma"><input type="text" placeholder="z. B. Max Mustermann" value={form.kundeName} onChange={e=>setForm({...form,kundeName:e.target.value})}/></Field>
        <Field label="Adresse"><input type="text" placeholder="Straße und Hausnummer" value={form.kundeAdresse} onChange={e=>setForm({...form,kundeAdresse:e.target.value})}/></Field>
        <Field label="PLZ / Ort"><input type="text" placeholder="PLZ und Ort" value={form.kundeOrt} onChange={e=>setForm({...form,kundeOrt:e.target.value})}/></Field>
        <Field label="Kontakt / Telefon"><input type="text" placeholder="optional" value={form.kundeKontakt} onChange={e=>setForm({...form,kundeKontakt:e.target.value})}/></Field>
      </section>

      <section className="section">
        <h2>Zeitraum</h2>
        <div className="grid two">
          <Field label="Von"><input type="date" value={form.datumVon} onChange={e=>setForm({...form,datumVon:e.target.value})}/></Field>
          <Field label="Bis"><input type="date" value={form.datumBis} onChange={e=>setForm({...form,datumBis:e.target.value})}/></Field>
        </div>
      </section>

      <section className="section">
        <h2>Einsatz</h2>
        <Field label="Fahrer"><input type="text" placeholder="Fahrer eintippen" value={form.fahrer} onChange={e=>setForm({...form,fahrer:e.target.value})}/></Field>
        <Field label="Fahrer-Stundensatz">
          <input type="text" inputMode="decimal" placeholder="z. B. 45" value={form.fahrerStundensatz} onChange={e=>setForm({...form,fahrerStundensatz:e.target.value})}/>
        </Field>
        <Field label="Einsatzart">
          <select value={form.einsatzart} onChange={e=>setForm({...form,einsatzart:e.target.value})}>
            <option value="innerbetrieblich">Innerbetrieblich</option>
            <option value="ueberbetrieblich">Überbetrieblich</option>
          </select>
        </Field>
      </section>

      <section className="section">
        <h2>Betriebsstunden Zugmaschine</h2>
        <button type="button" className="secondary" onClick={takeLastValue} disabled={loading||!form.zugmaschine}>{loading?"Lade...":"Letzten Wert übernehmen"}</button>
        <div className="grid two">
          <Field label="Stundenzähler Beginn"><input type="text" inputMode="decimal" placeholder="z. B. 1250,5" value={form.stundenStart} onChange={e=>setForm({...form,stundenStart:e.target.value})}/></Field>
          <Field label="Stundenzähler Ende"><input type="text" inputMode="decimal" placeholder="z. B. 1253,0" value={form.stundenEnde} onChange={e=>setForm({...form,stundenEnde:e.target.value})}/></Field>
        </div>
        <div className={!hasValidHours&&form.stundenStart&&form.stundenEnde?"result error":"result"}><span>Stunden</span><strong>{formatHours(gefahreneStunden)}</strong></div>
        <div className="price-box"><span>Maschinenkosten</span><strong>{formatEuro(machineCost)}</strong></div>
      </section>

      <section className="section">
        <h2>Arbeitszeit Fahrer</h2>
        <div className="stopwatch">
          <strong>{secondsToClock(stopwatchSeconds)}</strong>
          <div className="stopwatch-buttons">
            <button type="button" className="secondary" onClick={()=>setStopwatchRunning(true)} disabled={stopwatchRunning}>Start</button>
            <button type="button" className="small-button" onClick={()=>setStopwatchRunning(false)} disabled={!stopwatchRunning}>Pause</button>
            <button type="button" className="small-button" onClick={resetStopwatch}>Reset</button>
          </div>
          <button type="button" className="small-button" onClick={useStopwatchAsWorkTime}>Zeit übernehmen</button>
        </div>
        <Field label="Arbeitszeit Fahrer in Stunden"><input type="text" inputMode="decimal" placeholder="z. B. 2,5" value={form.arbeitszeitStunden} onChange={e=>setForm({...form,arbeitszeitStunden:e.target.value})}/></Field>
        <div className="driver-box"><span>Fahrerkosten</span><strong>{formatEuro(driverCost)}</strong></div>
      </section>

      <section className="section">
        <h2>Gesamt</h2>
        <div className="total-box"><span>Gesamtkosten</span><strong>{formatEuro(totalCost)}</strong></div>
      </section>

      <section className="section">
        <h2>Diesel & Bemerkung</h2>
        <Field label="Getankte Dieselmenge in Liter"><input type="text" inputMode="decimal" placeholder="z. B. 18,5" value={form.diesel} onChange={e=>setForm({...form,diesel:e.target.value})}/></Field>
        <Field label="Bemerkung / Schäden"><textarea placeholder="z. B. Schaden, Wartung, Besonderheiten" value={form.bemerkung} onChange={e=>setForm({...form,bemerkung:e.target.value})}/></Field>
      </section>

      <div className="button-grid">
        <button className="primary" type="submit" disabled={!canSave}>{sending?"Speichert...":"Eintrag speichern"}</button>
        <button className="secondary" type="button" onClick={previewDeliveryNote}>Lieferschein Vorschau</button>
      </div>
    </form>

    <footer>© by Steininger Flo</footer>
  </main></div>;
}
