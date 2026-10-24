import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
const NATURE = `UPPER(COALESCE(a.account_nature,''))='CREDIT' OR LOWER(COALESCE(a.type,'')) IN ('liability','equity','revenue')`;
async function range(s,e){
  const rows = (await c.query(`
    SELECT a.id,a.code,a.type,a.account_nature,
      COALESCE((SELECT SUM(CASE WHEN ${NATURE} THEN ji.credit-ji.debit ELSE ji.debit-ji.credit END)
        FROM journal_items ji JOIN journal_entries je ON je.id=ji.journal_entry_id
        WHERE ji.account_id=a.id AND je.date::date < $1 AND je.status='posted'),0)::numeric ob,
      COALESCE((SELECT SUM(ji.debit) FROM journal_items ji JOIN journal_entries je ON je.id=ji.journal_entry_id
        WHERE ji.account_id=a.id AND je.date::date BETWEEN $2 AND $3 AND je.status='posted'),0)::numeric pd,
      COALESCE((SELECT SUM(ji.credit) FROM journal_items ji JOIN journal_entries je ON je.id=ji.journal_entry_id
        WHERE ji.account_id=a.id AND je.date::date BETWEEN $2 AND $3 AND je.status='posted'),0)::numeric pc
    FROM accounts a WHERE a.status=true`,[s,s,e])).rows;
  let td=0,tc=0; const out=[];
  for(const r of rows){
    const isC = String(r.account_nature||'').toUpperCase()==='CREDIT' || ['liability','equity','revenue'].includes(r.type);
    const b = isC ? Number(r.ob)+Number(r.pc)-Number(r.pd) : Number(r.ob)+Number(r.pd)-Number(r.pc);
    if(b>0&&!isC) td+=b; else if(b>0&&isC) tc+=b; else if(b<0&&isC) td+=-b; else if(b<0&&!isC) tc+=-b;
    out.push({code:r.code,balance:Math.round(b*100)/100});
  }
  return {td:Math.round(td*100)/100,tc:Math.round(tc*100)/100,out};
}
const A=await range('2026-10-01','2026-10-31');
const B=await range('2026-10-31','2026-10-31');
console.log("range1",A.td,A.tc,"diff",(A.td-A.tc).toFixed(2));
console.log("range2",B.td,B.tc,"diff",(B.td-B.tc).toFixed(2));
console.log("4102 r1:",A.out.find(x=>x.code==='4102'),"r2:",B.out.find(x=>x.code==='4102'));
const diffs=A.out.filter(x=>{const y=B.out.find(z=>z.code===x.code); return y && Math.abs(x.balance-y.balance)>0.001;});
console.log("accounts differing:",diffs.length, diffs.slice(0,5));
await c.end();
