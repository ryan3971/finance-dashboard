## Other
- Better way to mark refunds; currently use the rebalancing feature but that may be misleading. Refunds could also be auto marked similar to how transfers are.

## Importing
### General
- During Imports; medium priority; cancel button

### Amex Import
- An Amex transaction was marked as positive when it should have been negative. This pipeline may need to be reviewed for any bugs.

### AI Categorization
- AI Categorization; low priority; toggle in settings, confidence threshold slider, progress bar during import

### Transfer
- Maybe add a button to run transfer detection on all transactions after import? (I'm unsure if transactions already imported are being picked up)

## Rules
### General
- Flag specific categories/subcategories for review (e.g., if the user wants to review all transactions categorized as "Food: Dining Out" to make sure they were categorized correctly, they could flag that category/subcategory for review and then filter transactions by that flag and category/subcategory)

### Investment
- Add investment categorization to the rules

## Categories
### General
- How does updating a category affect the transactions that are already categorized with it? Do they get updated to reflect the new category name, or do they stay the same? If they stay the same, it could lead to confusion and inconsistency in the data. It would be better if updating a category also updated all transactions that are categorized with it to reflect the new category name (similar to transactiopns, an update button). Also, though, categories can;t be updated, currently.
- Can't remove/uncategorized something once it has a category applied to it. It would be good to have an option to remove a category from a transaction or to uncategorize it, especially if the user realizes that a transaction was categorized incorrectly or if they want to change the category for some reason.
- Category/subcategory does not show when selecting a transaction for review, or editing a rule. THe fields should autopopulate with the current category/subcategory of the transaction, so the user can see what it is currently categorized as and make changes if necessary.
- The category icons aren't being used for anything right now

## Transactions
### General
- Need review flag (and other filters I guess) are limited to what is shows for that page of results, not all transactions. This is especially important for the need review flag, as it is easy to miss transactions that need review if there are many transactions and only a portion of them are being shown at a time.
- When a transaction is edited, it may rearrange their order in the transaction list, which can be confusing and make it difficult to find the transaction again after editing it.
- Ability to edit other details of a transaction (date, amount, etc.) in case it ws imported incorrectly.
- Ability to Multi select transactions, so you can delete all at once, or apply a tag/note across all of them.
- Ability to search transactions (by description, note, amount, etc). Also, sorting by the absolute value for amount could be useful for quickly identifying refunds and large transactions.
- The NA and - may be unnecessary for the Need/Want field. If Need/want is unselected, it is implied that it is NA, and if it is selected, it is implied that it is either a need or a want. At the very least only NA or - can be used, not both

### Delete / Bulk delete
- Add the ability to delete transactions and to bulk delete transactions. This is important for cleaning up any transactions that were imported incorrectly or that are no longer relevant.

### Investments
- Investment Contributions showing as expenses in the Expense Dashboard, despite being flagged as an Investment

## Budgeting
### General
- Can't add 0 as a value for the budget override; ran into this as an issue when adding my salary and wanting to add 0 for the months I was unemployed.


## Other
- Pagination may come into play for tables other than the transactions table as more items are added (e.g., rules, budgets, rebalancing history, etc.)