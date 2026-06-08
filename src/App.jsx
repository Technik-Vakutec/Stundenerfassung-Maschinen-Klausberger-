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
    maschine:"",
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

  const[machines,setMachines]=useState([]);
  const[newMachine,setNewMachine]=useState("");
  const[newRate,setNewRate]=useState("");
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

  const selectedMachine=machines.find(machine=>machine.name===form.maschine);
  const machineRate=selectedMachine?Number(selectedMachine.rate||0):0;

  const startNumber=parseDecimal(form.stundenStart);
  const endNumber=parseDecimal(form.stundenEnde);
  const dieselNumber=parseDecimal(form.diesel);
  const manualDriverHours=parseDecimal(form.arbeitszeitStunden);

  const gefahreneStunden=useMemo(()=>{
    const start=parseDecimal(form.stundenStart);
    const ende=parseDecimal(form.stundenEnde);
    if(Number.isNaN(start)||Number.isNaN(ende))return"";
    return Math.round((ende-start)*100)/100;
  },[form.stundenStart,form.stundenEnde]);

  const hasValidHours=gefahreneStunden!==""&&gefahreneStunden>=0;
  const machineCost=hasValidHours?Math.round(Number(gefahreneStunden)*machineRate*100)/100:"";
  const driverHoursFromStopwatch=Math.round((stopwatchSeconds/3600)*100)/100;
  const driverHours=!Number.isNaN(manualDriverHours)?manualDriverHours:driverHoursFromStopwatch;

  const canSave=
    form.datumVon&&
    form.datumBis&&
    form.fahrer.trim()&&
    form.maschine&&
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
      const list=Array.isArray(data.machines)?data.machines.map(machine=>({
        name:String(machine.name||machine.maschine||machine||"").trim(),
        rate:Number(machine.rate||machine.stundensatz||0)
      })).filter(machine=>machine.name):[];
      setMachines(list);
      if(!form.maschine&&list.length>0)setForm(current=>({...current,maschine:list[0].name}));
    }catch{
      setMessage("Maschinen konnten nicht geladen werden. Bitte Google-Script prüfen.");
    }finally{
      setLoading(false);
    }
  }

  async function takeLastValue(){
    setMessage("");
    if(!SHEET_WEBAPP_URL){setMessage("Google-Script-Link fehlt noch.");return}
    if(!form.maschine){alert("Bitte zuerst eine Maschine auswählen.");return}
    setLoading(true);
    try{
      const data=await apiGet("last",`&machine=${encodeURIComponent(form.maschine)}`);
      if(!data.ok||data.lastEnde===""||data.lastEnde===null||data.lastEnde===undefined){
        setMessage(`Für ${form.maschine} wurde noch kein letzter Stundenzähler gefunden.`);
        return;
      }
      const last=String(data.lastEnde).replace(".",",");
      setForm(current=>({...current,stundenStart:last}));
      setMessage(`Letzter Stundenzähler für ${form.maschine} übernommen: ${last}`);
    }catch{
      setMessage("Letzter Wert konnte nicht geladen werden.");
    }finally{
      setLoading(false);
    }
  }

  async function addMachine(){
    const name=newMachine.trim();
    const rate=parseDecimal(newRate);
    if(!name){alert("Bitte Maschinennamen eingeben.");return}
    if(Number.isNaN(rate)||rate<0){alert("Bitte einen gültigen Stundensatz eingeben.");return}
    if(machines.some(machine=>machine.name===name)){alert("Diese Maschine ist bereits vorhanden.");return}
    setLoading(true);
    setMessage("");
    try{
      await apiPost({action:"addMachine",maschine:name,stundensatz:rate});
      const updated=[...machines,{name,rate}].sort((a,b)=>a.name.localeCompare(b.name,"de"));
      setMachines(updated);
      setNewMachine("");
      setNewRate("");
      setForm(current=>({...current,maschine:name}));
      setMessage(`Maschine hinzugefügt: ${name} mit ${formatEuro(rate)} / Stunde`);
    }catch{
      setMessage("Maschine konnte nicht hinzugefügt werden.");
    }finally{
      setLoading(false);
    }
  }

  async function deleteMachine(name){
    if(!confirm(`Maschine wirklich löschen?\n\n${name}`))return;
    setLoading(true);
    setMessage("");
    try{
      await apiPost({action:"deleteMachine",maschine:name});
      const updated=machines.filter(machine=>machine.name!==name);
      setMachines(updated);
      if(form.maschine===name)setForm(current=>({...current,maschine:updated[0]?.name||""}));
      setMessage(`Maschine gelöscht: ${name}`);
    }catch{
      setMessage("Maschine konnte nicht gelöscht werden.");
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
        maschine:form.maschine,
        einsatzart:form.einsatzart==="ueberbetrieblich"?"überbetrieblich":"innerbetrieblich",
        stundenStart:startNumber,
        stundenEnde:endNumber,
        maschinenstunden:Number(gefahreneStunden),
        stundensatz:machineRate,
        kosten:machineCost,
        diesel:Number.isNaN(dieselNumber)?0:dieselNumber,
        fahrerArbeitszeit:Number.isNaN(driverHours)?0:driverHours,
        bemerkung:form.bemerkung.trim()
      }
    };
  }

  function openDeliveryNote(data){
    const d=data;
    const html=`<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8"/>
<title>${htmlEscape(d.lsNumber)} Lieferschein</title>
<style>
  body{font-family:Arial,sans-serif;color:#111827;margin:0;padding:32px;background:#fff}
  .page{max-width:850px;margin:0 auto}
  .top{display:flex;justify-content:space-between;gap:30px;border-bottom:3px solid #111827;padding-bottom:18px}
  h1{font-size:34px;margin:0 0 8px;letter-spacing:.04em}
  h2{font-size:16px;margin:28px 0 8px;border-bottom:1px solid #d1d5db;padding-bottom:6px}
  p{margin:3px 0;line-height:1.35}
  .muted{color:#6b7280}
  .box{border:1px solid #d1d5db;border-radius:10px;padding:14px;margin-top:10px}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th,td{border:1px solid #d1d5db;padding:10px;text-align:left;font-size:14px}
  th{background:#f3f4f6}
  .right{text-align:right}
  .signatures{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:70px}
  .line{border-top:1px solid #111827;padding-top:8px;text-align:center}
  @media print{body{padding:0}.page{max-width:none}.no-print{display:none}}
</style>
</head>
<body>
<div class="page">
  <div class="top">
    <div>
      <h1>LIEFERSCHEIN</h1>
      <p><strong>Nr.:</strong> ${htmlEscape(d.lsNumber)}</p>
      <p><strong>Datum:</strong> ${htmlEscape(d.datum)}</p>
    </div>
    <div>
      <p><strong>${htmlEscape(d.dienstleister.name)}</strong></p>
      <p>${htmlEscape(d.dienstleister.adresse)}</p>
      <p>${htmlEscape(d.dienstleister.ort)}</p>
      <p>${htmlEscape(d.dienstleister.telefon)}</p>
      <p>${htmlEscape(d.dienstleister.email)}</p>
    </div>
  </div>

  <h2>Kunde / Auftraggeber</h2>
  <div class="box">
    <p><strong>${htmlEscape(d.kunde.name)}</strong></p>
    <p>${htmlEscape(d.kunde.adresse)}</p>
    <p>${htmlEscape(d.kunde.ort)}</p>
    <p>${htmlEscape(d.kunde.kontakt)}</p>
  </div>

  <h2>Einsatzdaten</h2>
  <p><strong>Zeitraum:</strong> ${htmlEscape(d.einsatz.datumVon)} bis ${htmlEscape(d.einsatz.datumBis)}</p>
  <p><strong>Fahrer:</strong> ${htmlEscape(d.einsatz.fahrer)}</p>
  <p><strong>Maschine:</strong> ${htmlEscape(d.einsatz.maschine)}</p>
  <p><strong>Einsatzart:</strong> ${htmlEscape(d.einsatz.einsatzart)}</p>

  <table>
    <thead>
      <tr>
        <th>Position</th>
        <th class="right">Menge</th>
        <th>Einheit</th>
        <th class="right">Stundensatz</th>
        <th class="right">Gesamt</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${htmlEscape(d.einsatz.maschine)}</td>
        <td class="right">${htmlEscape(formatHours(d.einsatz.maschinenstunden))}</td>
        <td>Maschinenstunden</td>
        <td class="right">${htmlEscape(formatEuro(d.einsatz.stundensatz))}</td>
        <td class="right">${htmlEscape(formatEuro(d.einsatz.kosten))}</td>
      </tr>
    </tbody>
  </table>

  <h2>Weitere Angaben</h2>
  <p><strong>Stundenzähler Beginn:</strong> ${htmlEscape(d.einsatz.stundenStart)}</p>
  <p><strong>Stundenzähler Ende:</strong> ${htmlEscape(d.einsatz.stundenEnde)}</p>
  <p><strong>Arbeitszeit Fahrer:</strong> ${htmlEscape(formatHours(d.einsatz.fahrerArbeitszeit))}</p>
  <p><strong>Diesel:</strong> ${htmlEscape(d.einsatz.diesel)} Liter</p>
  <p><strong>Bemerkung:</strong> ${htmlEscape(d.einsatz.bemerkung)}</p>

  <div class="signatures">
    <div class="line">Unterschrift Kunde</div>
    <div class="line">Unterschrift Fahrer</div>
  </div>

  <p class="muted no-print" style="margin-top:40px">Zum Speichern als PDF bitte Drucken öffnen und „Als PDF sichern“ wählen.</p>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body>
</html>`;
    const win=window.open("","_blank");
    if(!win){
      alert("Popup wurde blockiert. Bitte Popups für diese Seite erlauben.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  function previewDeliveryNote(){
    if(!form.kundeName.trim()){
      alert("Bitte zuerst den Kunden eingeben.");
      return;
    }
    if(!form.maschine||!form.fahrer.trim()){
      alert("Bitte Maschine und Fahrer ausfüllen.");
      return;
    }
    if(!hasValidHours){
      alert("Bitte gültige Betriebsstunden eingeben.");
      return;
    }
    openDeliveryNote(buildDeliveryNoteData());
  }

  async function saveEntry(event){
    event.preventDefault();
    setMessage("");
    setLastDeliveryNote(null);

    if(!SHEET_WEBAPP_URL){
      setMessage("Google-Script-Link fehlt noch.");
      return;
    }
    if(!canSave){
      alert("Bitte alle Pflichtfelder richtig ausfüllen.");
      return;
    }

    setSending(true);
    const previewData=buildDeliveryNoteData();

    const payload={
      action:"entry",
      datumVon:form.datumVon,
      datumBis:form.datumBis,
      fahrer:form.fahrer.trim(),
      maschine:form.maschine,
      maschinenStundensatz:machineRate,
      maschinenKosten:machineCost,
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
      const finalData={...previewData,lsNumber};
      setLastDeliveryNote(finalData);
      setMessage("Eintrag wurde gespeichert. Der Lieferschein kann jetzt erstellt werden.");
      setForm({
        datumVon:today,
        datumBis:today,
        fahrer:"",
        maschine:form.maschine,
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

    {lastDeliveryNote&&<div className="message action-message">
      <span>Lieferschein {lastDeliveryNote.lsNumber} bereit.</span>
      <button type="button" className="secondary" onClick={()=>openDeliveryNote(lastDeliveryNote)}>Lieferschein PDF</button>
    </div>}

    <form onSubmit={saveEntry} className="form">
      <section className="section">
        <div className="section-head">
          <h2>Maschine</h2>
          <button type="button" className="small-button" onClick={()=>setShowManage(!showManage)}>
            {showManage?"Schließen":"Maschinen bearbeiten"}
          </button>
        </div>

        <Field label="Maschine auswählen">
          <select value={form.maschine} onChange={e=>setForm({...form,maschine:e.target.value,stundenStart:""})}>
            <option value="">Bitte Maschine auswählen</option>
            {machines.map(machine=><option key={machine.name} value={machine.name}>{machine.name} — {formatEuro(machine.rate)}/h</option>)}
          </select>
        </Field>

        {selectedMachine&&<div className="info-box">Stundensatz dieser Maschine: <strong>{formatEuro(machineRate)} / Stunde</strong></div>}

        {showManage&&<div className="manage-box">
          <div className="add-row">
            <input type="text" placeholder="Neue Maschine, z. B. TB290" value={newMachine} onChange={e=>setNewMachine(e.target.value)}/>
            <input type="text" inputMode="decimal" placeholder="Stundensatz €" value={newRate} onChange={e=>setNewRate(e.target.value)}/>
            <button type="button" className="secondary" onClick={addMachine} disabled={loading}>Hinzufügen</button>
          </div>
          <div className="machine-list">
            {machines.length===0&&<div className="empty">Noch keine Maschine angelegt.</div>}
            {machines.map(machine=><div className="machine-item" key={machine.name}>
              <span>{machine.name}<small>{formatEuro(machine.rate)} / Stunde</small></span>
              <button type="button" onClick={()=>deleteMachine(machine.name)}>Löschen</button>
            </div>)}
          </div>
        </div>}
      </section>

      <section className="section">
        <h2>Kunde / Auftraggeber</h2>
        <Field label="Kunde / Firma">
          <input type="text" placeholder="z. B. Max Mustermann" value={form.kundeName} onChange={e=>setForm({...form,kundeName:e.target.value})}/>
        </Field>
        <Field label="Adresse">
          <input type="text" placeholder="Straße und Hausnummer" value={form.kundeAdresse} onChange={e=>setForm({...form,kundeAdresse:e.target.value})}/>
        </Field>
        <Field label="PLZ / Ort">
          <input type="text" placeholder="PLZ und Ort" value={form.kundeOrt} onChange={e=>setForm({...form,kundeOrt:e.target.value})}/>
        </Field>
        <Field label="Kontakt / Telefon">
          <input type="text" placeholder="optional" value={form.kundeKontakt} onChange={e=>setForm({...form,kundeKontakt:e.target.value})}/>
        </Field>
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
        <Field label="Fahrer">
          <input type="text" placeholder="Fahrer eintippen" value={form.fahrer} onChange={e=>setForm({...form,fahrer:e.target.value})}/>
        </Field>
        <Field label="Einsatzart">
          <select value={form.einsatzart} onChange={e=>setForm({...form,einsatzart:e.target.value})}>
            <option value="innerbetrieblich">Innerbetrieblich</option>
            <option value="ueberbetrieblich">Überbetrieblich</option>
          </select>
        </Field>
      </section>

      <section className="section">
        <h2>Betriebsstunden Maschine</h2>
        <button type="button" className="secondary" onClick={takeLastValue} disabled={loading||!form.maschine}>
          {loading?"Lade...":"Letzten Wert übernehmen"}
        </button>
        <div className="grid two">
          <Field label="Stundenzähler Beginn"><input type="text" inputMode="decimal" placeholder="z. B. 1250,5" value={form.stundenStart} onChange={e=>setForm({...form,stundenStart:e.target.value})}/></Field>
          <Field label="Stundenzähler Ende"><input type="text" inputMode="decimal" placeholder="z. B. 1253,0" value={form.stundenEnde} onChange={e=>setForm({...form,stundenEnde:e.target.value})}/></Field>
        </div>
        <div className={!hasValidHours&&form.stundenStart&&form.stundenEnde?"result error":"result"}>
          <span>Maschinenstunden</span>
          <strong>{formatHours(gefahreneStunden)}</strong>
        </div>
        <div className="price-box">
          <span>Maschinenkosten</span>
          <strong>{formatEuro(machineCost)}</strong>
        </div>
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
        <Field label="Arbeitszeit Fahrer in Stunden">
          <input type="text" inputMode="decimal" placeholder="z. B. 2,5" value={form.arbeitszeitStunden} onChange={e=>setForm({...form,arbeitszeitStunden:e.target.value})}/>
        </Field>
      </section>

      <section className="section">
        <h2>Diesel & Bemerkung</h2>
        <Field label="Getankte Dieselmenge in Liter">
          <input type="text" inputMode="decimal" placeholder="z. B. 18,5" value={form.diesel} onChange={e=>setForm({...form,diesel:e.target.value})}/>
        </Field>
        <Field label="Bemerkung / Schäden">
          <textarea placeholder="z. B. Schaden, Wartung, Besonderheiten" value={form.bemerkung} onChange={e=>setForm({...form,bemerkung:e.target.value})}/>
        </Field>
      </section>

      <div className="button-grid">
        <button className="primary" type="submit" disabled={!canSave}>{sending?"Speichert...":"Eintrag speichern"}</button>
        <button className="secondary" type="button" onClick={previewDeliveryNote}>Lieferschein Vorschau</button>
      </div>
    </form>

    <footer>© by Steininger Flo</footer>
  </main></div>;
}
