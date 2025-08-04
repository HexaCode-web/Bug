# issue description

This is a part of the code of a system we are working on.
the expected flow as below

- the user thinks about bulk importing some purchase order
- the user clicks on the "استيراد"
- the user downloads a template
- the user uploads the template with the data
- the system write to firebase each purchase order
- the system gives a result in the bottom
- the imported purchase orders should be the same amount that are in the sheet

## What goes wrong

- if the user imports for example 100 purchase order, the system only write down 99
- even though it provides info to the user that they imported all 100, but when user goes back to display the data he sees only 99
