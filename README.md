EditTable
=========

A small jQuery plugin to make your HTML tables editable.

When you click on a table cell, it is replaced with an editor that lets you change the value.

*    Requires jQuery, but doesn't have any other dependencies
*    Works on any standard HTML table and doesn't require additional markup
*    Works great with Twitter Bootstrap, jQueryUI, and other CSS frameworks
*    Keyboard navigation to move to different table cells (tab, shift+tab, up, down)
*    Comes with 2 built-in editors - Text and Select - and it's easy to add your own
*    Get table contents as a JSON array at any time

Basic Usage
--------------

EditTable requires a recent version of jQuery.

```html
<script src="//ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js"></script>
<script src='lib/EditTable.js'></script>
```

Making an existing HTML table editable is easy:

```html
<table id="my_table">
    ...
</table>

<script>
$("#my_table").editTable();

// Get the rows as an array of JSON objects
var rows = $("#my_table").editTable('rows');
</script>
```

Checkout out the [examples](http://htmlpreview.github.io/?http://github.com/jdorn/EditTable/blob/master/examples.html) for more advanced options.
