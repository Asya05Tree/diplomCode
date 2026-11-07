# PoC — TAB 05 Список покупок

Run against the live backend at `http://localhost:5080` (MySQL docker `planner-mysql`).

```
cd adversarial-review/poc/05-shopping
node idor.mjs
node price-validation.mjs
node finance-double-count.mjs
node mass-assignment.mjs
node plan-trip-spam.mjs
node autocategorization.mjs
node data-limits.mjs
```

Each script provisions its own `adv.t05.*@gmail.com` accounts and prints
`CONFIRMED` / `REFUTED` lines with **observed vs expected**.
`autocategorization.mjs` imports the real client util (no server needed).
