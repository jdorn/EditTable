EditTable
=========

A small javascript class to make any table editable.

When you click on a table cell, it is replaced with an editor that lets you change the value.
When you click somewhere else, the editor closes and saves the value to the table.

*    Requires jQuery, but doesn't have any other dependencies
*    Works on any standard HTML table and doesn't require additional markup
*    Works great with Twitter Bootstrap, jQueryUI, and other CSS frameworks
*    Keyboard navigation to move to different table cells (tab, shift+tab, up, down)
*    Comes with 3 default editors: Text, Select, and LongText.  You can easily add your own as well.

Basic Usage
--------------

EditTable requires a recent version of jQuery.

```html
<script src='lib/jquery-1.8.3.min.js' type='text/javascript'></script>
<script src='lib/EditTable.js' type='text/javascript'></script>
```

Making an existing HTML table editable is easy:

```html
<table id="my_table">
    ...
</table>

<script>
var table = new EditTable("#my_table");
</script>
```

The default editor is a basic text input box, however you can specify a different editor on a per-column basis.

```js
// During initialization
var table = new EditTable("#my_table",{
    "My Column": {
        "editor": "LongText"
    }
});

// After initialization
table.setEditor("My Other Column", "LongText");
```

Some editors also take options.

```js
// During initialization
var table = new EditTable("#my_table",{
    "My Column": {
        "editor": "Select",
        "options": {
            "values": ["Option 1","Option 2"]
        }
    }
});

// After initialization
table.setEditor("My Other Column", "Select", {
    values: ["Option 1","Option 2"]
});
```
