\*\*\*\*# Manual Test Guide

This guide walks through importing the `*_manual.csv` fixtures and verifying that
rules, categorization, transfer detection, and dashboard values are all correct.

All data is for **March 2026**. Keep the dashboard year filter set to **2026**.

---

## 1. Account Setup

Create these three accounts before importing anything:

| Account name | Institution | Type     |
| ------------ | ----------- | -------- |
| My Chequing  | TD          | chequing |
| My AMEX      | AMEX        | credit   |
| My CIBC Visa | CIBC        | credit   |

---

## 2. Import Order

Import in this exact order — it maximises automatic pair-matching during transfer detection:

1. `cibc.csv` → My CIBC Visa
2. `td.csv` → My Chequing
3. `amex.csv` → My AMEX

**Why order matters:** transfer detection only scans the _newly imported_ batch for pairs.
Importing CIBC first puts its payment (+500.00) in the DB so that when TD imports, the
e-transfer out (-500.00) finds it as a pair immediately (HIGH confidence). The same
logic applies to the AMEX payment after TD is already in the DB.

---

## 3. Transfer Detection — Expected Flags Per Import

### After CIBC import

| Transaction             | Flagged? | Confidence | Reason                                   |
| ----------------------- | -------- | ---------- | ---------------------------------------- |
| PAYMENT THANK YOU/MERCI | Yes      | MEDIUM     | Keyword `payment thank you`, no pair yet |
| All others              | No       | —          | No transfer keyword, no matching amount  |

### After TD import

| Transaction              | Flagged? | Confidence | Paired with                       |
| ------------------------ | -------- | ---------- | --------------------------------- |
| E-TRANSFER OUT \*\*\*abc | Yes      | HIGH       | CIBC: PAYMENT THANK YOU/MERCI     |
| E-TRANSFER OUT \*\*\*zzz | Yes      | MEDIUM     | No pair (unique amount -75.00)    |
| CREDIT CARD PYMT MSP     | No       | —          | No keyword; AMEX not imported yet |
| All others               | No       | —          |                                   |

> **Note on E-TRANSFER OUT \*\*\*abc:** The categorization rule for `e-transfer`
> (needWant = `ADD`) also flags this transaction for review independently of transfer
> detection. The ADD sentinel means: no category assigned, flagged pending human judgment.
> Both flags are set; confirming it as a transfer clears them both.

### After AMEX import

| Transaction                  | Flagged? | Confidence | Paired with              |
| ---------------------------- | -------- | ---------- | ------------------------ |
| PAYMENT RECEIVED - THANK YOU | Yes      | HIGH       | TD: CREDIT CARD PYMT MSP |
| All others                   | No       | —          |                          |

> **Note on TD CREDIT CARD PYMT MSP:** it has no transfer keyword and was imported before
> its AMEX pair existed, so it is **not** flagged automatically. It surfaces as the pair
> target when you review the AMEX transaction. Confirming that review marks both sides.

---

## 4. Transfer Confirmation Checklist

Work through the flagged items in this order. After all three steps, no transfers
should remain in the review queue.

### Step 1 — Confirm the e-transfer pair (HIGH confidence)

- Find: **TD — E-TRANSFER OUT \*\*\*abc** (flagged, HIGH confidence)
- Confirm it as a transfer, linked to its pair: **CIBC — PAYMENT THANK YOU/MERCI**
- Expected result: both transactions set to `isTransfer = true`, removed from
  the review queue

### Step 2 — Confirm the AMEX payment pair (HIGH confidence)

- Find: **AMEX — PAYMENT RECEIVED - THANK YOU** (flagged, HIGH confidence)
- Confirm it as a transfer, linked to its pair: **TD — CREDIT CARD PYMT MSP**
- Expected result: both transactions set to `isTransfer = true`, removed from
  the review queue (TD CREDIT CARD PYMT MSP disappears from expenses too)

### Step 3 — Confirm the unmatched e-transfer (MEDIUM confidence, no pair)

- Find: **TD — E-TRANSFER OUT \*\*\*zzz** (flagged, MEDIUM, no pair)
- Confirm it as a transfer with no linked pair
- Expected result: this transaction set to `isTransfer = true`, removed from queue

---

## 5. Categorization Reference

Expected result for every transaction after import and rule application.
Transfers confirmed in section 4 are marked with _(transfer)_.

### TD — My Chequing

| Description                 | Category         | Subcategory | Need/Want | isIncome | Notes                                                                                         |
| --------------------------- | ---------------- | ----------- | --------- | -------- | --------------------------------------------------------------------------------------------- |
| PRODIGY EDUCATION INC PAYRL | Salary           | Paycheque   | NA        | true     | Keyword: `prodigy educati`                                                                    |
| GST GST TAX REFUND          | Government       | GST         | NA        | true     | Keyword: `gst gst`                                                                            |
| WALMART GROCERY STORE 321   | Food             | Groceries   | Need      | false    | Keyword: `walmart`                                                                            |
| PRESTO TOPUP                | Transport        | Transit     | Need      | false    | Keyword: `presto`                                                                             |
| CREDIT CARD PYMT MSP        | Uncategorized    | —           | —         | false    | No rule match; _(transfer)_ after step 2                                                      |
| E-TRANSFER OUT \*\*\*abc    | — (ADD sentinel) | —           | —         | false    | Keyword `e-transfer`, needWant=ADD → no category assigned, flagged; _(transfer)_ after step 1 |
| E-TRANSFER OUT \*\*\*zzz    | — (ADD sentinel) | —           | —         | false    | Same as above, no pair; _(transfer)_ after step 3                                             |
| CORNER STORE 456            | Uncategorized    | —           | —         | false    | No rule match                                                                                 |
| TIM HORTONS #227            | Food             | Eating Out  | Want      | false    | Keyword: `tim hortons`                                                                        |

### AMEX — My AMEX

| Description                  | Category      | Subcategory         | Need/Want | isIncome | Notes                                                                                                                                                                                      |
| ---------------------------- | ------------- | ------------------- | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TIM HORTONS #412             | Food          | Eating Out          | Want      | false    | Keyword: `tim hortons`                                                                                                                                                                     |
| NETFLIX.COM SUBSCRIPTION     | Subscriptions | Media               | Want      | false    | Keyword: `netflix`                                                                                                                                                                         |
| SHOPPERS DRUG MART 312       | Health        | Pharmacy            | Need      | false    | Keyword: `shoppers drug`                                                                                                                                                                   |
| AMZN MKTP CA\*123ABC         | Shopping      | Online Retail       | Want      | false    | Keyword: `amzn`                                                                                                                                                                            |
| PAYMENT RECEIVED - THANK YOU | Transfer      | Credit Card Payment | NA        | true     | Keyword: `payment received`; _(transfer)_ after step 2. isIncome=true because the adapter negates the CSV amount (-245.00 → +245.00); excluded from income dashboard once isTransfer=true. |
| SUNRISE BOUTIQUE 99812       | Uncategorized | —                   | —         | false    | No rule match                                                                                                                                                                              |

> **AMEX amount sign convention:** the CSV amount is positive for charges and negative
> for payments. The adapter negates all values on import. So a charge of `12.00` in the
> CSV becomes `-12.00` in the DB (money out), and the payment of `-245.00` becomes
> `+245.00` in the DB (money in).

### CIBC — My CIBC Visa

| Description                           | Category      | Subcategory         | Need/Want | isIncome | Notes                                                                                                                                                                                                 |
| ------------------------------------- | ------------- | ------------------- | --------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WALMART SUPERCENTRE 552 VANCOUVER, BC | Food          | Groceries           | Need      | false    | Keyword: `walmart`                                                                                                                                                                                    |
| TIM HORTONS 3351 VANCOUVER, BC        | Food          | Eating Out          | Want      | false    | Keyword: `tim hortons`                                                                                                                                                                                |
| LCBO #456 VANCOUVER, BC               | Food          | Alcohol             | Want      | false    | Keyword: `lcbo`                                                                                                                                                                                       |
| SPOTIFY CANADA                        | Subscriptions | Media               | Want      | false    | Keyword: `spotify`                                                                                                                                                                                    |
| PAYMENT THANK YOU/MERCI               | Transfer      | Credit Card Payment | NA        | true     | Keyword: `payment thank you`; _(transfer)_ after step 1. isIncome=true because the credit column value (+500.00) is stored as a positive amount; excluded from income dashboard once isTransfer=true. |
| HARDWARE SUPPLY 789 BURNABY, BC       | Uncategorized | —                   | —         | false    | No rule match                                                                                                                                                                                         |

---

## 6. Dashboard Verification

**Prerequisite:** complete all three confirmation steps in section 4 before checking
these values. Unconfirmed transfers are still counted as expenses until confirmed.

### Income — March 2026

| Source                      | Category   | Subcategory | Amount       |
| --------------------------- | ---------- | ----------- | ------------ |
| PRODIGY EDUCATION INC PAYRL | Salary     | Paycheque   | 4,000.00     |
| GST GST TAX REFUND          | Government | GST         | 500.00       |
| **Total income**            |            |             | **4,500.00** |

### Expenses — March 2026

#### Need

| Description                           | Account | Amount     |
| ------------------------------------- | ------- | ---------- |
| WALMART GROCERY STORE 321             | TD      | 150.00     |
| PRESTO TOPUP                          | TD      | 50.00      |
| SHOPPERS DRUG MART 312                | AMEX    | 45.00      |
| WALMART SUPERCENTRE 552 VANCOUVER, BC | CIBC    | 80.00      |
| **Need total**                        |         | **325.00** |

#### Want

| Description                    | Account | Amount     |
| ------------------------------ | ------- | ---------- |
| TIM HORTONS #227               | TD      | 8.50       |
| TIM HORTONS #412               | AMEX    | 12.00      |
| NETFLIX.COM SUBSCRIPTION       | AMEX    | 18.00      |
| AMZN MKTP CA\*123ABC           | AMEX    | 50.00      |
| TIM HORTONS 3351 VANCOUVER, BC | CIBC    | 8.00       |
| LCBO #456 VANCOUVER, BC        | CIBC    | 35.00      |
| SPOTIFY CANADA                 | CIBC    | 10.00      |
| **Want total**                 |         | **141.50** |

#### Uncategorized (no Need/Want assigned)

| Description             | Account | Amount     |
| ----------------------- | ------- | ---------- |
| CORNER STORE 456        | TD      | 35.00      |
| SUNRISE BOUTIQUE 99812  | AMEX    | 30.00      |
| HARDWARE SUPPLY 789 ... | CIBC    | 60.00      |
| **Uncategorized total** |         | **125.00** |

#### Expense summary

| Bucket        | Amount     |
| ------------- | ---------- |
| Need          | 325.00     |
| Want          | 141.50     |
| Uncategorized | 125.00     |
| **Total**     | **591.50** |

### YTD — March 2026

January and February have no data and should show as zero/empty.

| Field                    | March value  |
| ------------------------ | ------------ |
| Income                   | 4,500.00     |
| Investment contributions | 0.00         |
| Spending income          | 4,500.00     |
| Expenses                 | 591.50       |
| Net spending income      | **3,908.50** |
| Needs                    | 325.00       |
| Wants                    | 141.50       |

> Spending income = income − investment contributions. There are no investment
> transactions in this dataset, so spending income equals income.

---

## 7. What Each Scenario Proves

| Scenario                          | Transactions involved                                         | What it verifies                                                                       |
| --------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Rule match → category             | All non-transfer, non-uncategorized rows                      | Rules engine applies correct category, subcategory, and Need/Want                      |
| Want on debit account             | TD TIM HORTONS #227                                           | Want aggregation works for chequing accounts, not only credit cards                    |
| ADD sentinel                      | TD E-TRANSFER OUT \*\*\*abc, TD E-TRANSFER OUT \*\*\*zzz      | `needWant=ADD` rule flags for review without assigning a category                      |
| No rule match                     | CORNER STORE 456, SUNRISE BOUTIQUE 99812, HARDWARE SUPPLY 789 | Transactions fall back to Uncategorized                                                |
| HIGH confidence transfer          | TD E-TRANSFER OUT \*\*\*abc ↔ CIBC PAYMENT THANK YOU/MERCI    | Both description keyword and inverse amount pair detected                              |
| HIGH confidence transfer          | AMEX PAYMENT RECEIVED ↔ TD CREDIT CARD PYMT MSP               | Pair found across accounts; only the description-matched side is auto-flagged          |
| MEDIUM confidence transfer        | TD E-TRANSFER OUT \*\*\*zzz                                   | Description keyword present, no matching pair — flagged for review only                |
| LOW confidence (implicit)         | TD CREDIT CARD PYMT MSP                                       | No keyword; surfaces only as the pair target of the AMEX HIGH match                    |
| Transfers excluded from dashboard | All five transfer transactions                                | After confirmation, income = 4,500 and expenses = 591.50, not inflated by payment rows |
| AMEX sign negation                | AMEX PAYMENT RECEIVED (-245.00 CSV → +245.00 DB)              | Adapter correctly inverts the sign on import                                           |
