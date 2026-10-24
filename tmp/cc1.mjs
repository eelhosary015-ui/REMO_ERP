import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
const q = async (s) => (await c.query(s)).rows;
console.log("cost_centers:", await q("select id,code,name from cost_centers order by id"));
console.log("journal_items with cc:", await q("select count(*)::int n from journal_items where cost_center_id is not null"));
console.log("by cc:", await q(`select cc.id, cc.name, count(ji.id)::int n, coalesce(sum(ji.debit),0)::numeric d, coalesce(sum(ji.credit),0)::numeric c
 from cost_centers cc left join journal_items ji on ji.cost_center_id=cc.id group by 1,2 order by 1`));
console.log("cost tables:", await q("select table_name from information_schema.tables where table_schema='public' and (table_name like '%cost%') order by 1"));
await c.end();
