(function($) {
    /* Simple JavaScript Inheritance
     * By John Resig http://ejohn.org/
     * MIT Licensed.
     */
    // Inspired by base2 and Prototype
    (function(){
        var initializing = false, fnTest = /xyz/.test(function(){xyz;}) ? /\b_super\b/ : /.*/;
        // The base Class implementation (does nothing)
        this.Class = function(){};

        // Create a new Class that inherits from this class
        Class.extend = function(prop) {
            var _super = this.prototype;

            // Instantiate a base class (but only create the instance,
            // don't run the init constructor)
            initializing = true;
            var prototype = new this();
            initializing = false;

            // Copy the properties over onto the new prototype
            for (var name in prop) {
                // Check if we're overwriting an existing function
                prototype[name] = typeof prop[name] == "function" &&
                    typeof _super[name] == "function" && fnTest.test(prop[name]) ?
                    (function(name, fn){
                        return function() {
                            var tmp = this._super;

                            // Add a new ._super() method that is the same method
                            // but on the super-class
                            this._super = _super[name];

                            // The method only need to be bound temporarily, so we
                            // remove it when we're done executing
                            var ret = fn.apply(this, arguments);
                            this._super = tmp;

                            return ret;
                        };
                    })(name, prop[name]) :
                    prop[name];
            }

            // The dummy class constructor
            function Class() {
                // All construction is actually done in the init method
                if ( !initializing && this.init )
                    this.init.apply(this, arguments);
            }

            // Populate our constructed prototype object
            Class.prototype = prototype;

            // Enforce the constructor to be what we expect
            Class.prototype.constructor = Class;

            // And make this class extendable
            Class.extend = arguments.callee;

            return Class;
        };
    })();

    /**
     * The main EditTable class
     */
    window.EditTable = Class.extend({
        /**
         * @constructor
         * @param table The table element to make editable
         * @param columns An object where the keys are column names and the value is options for that column
         * @param options Options for the EditTable
         */
        init: function(table, columns, options) {
            this.options = options || {};
            this._table = $(table);
            this._columns = columns;
            this._column_order = [];

            // The predefined editors
            var predefined_editors = editors = {
                Text: EditTable.TextEditor,
                LongText: EditTable.LongTextEditor,
                Select: EditTable.SelectEditor
            };

            var self = this;
            $.each(this._columns,function(i,el) {
                // Keep track of the columns by order
                self._column_order.push(i);

                // Get an editor instance for this column
                el.editor = el.editor || self.options.default_editor || 'Text';
                if(predefined_editors[el.editor]) {
                    el.editor = new predefined_editors[el.editor](self);
                }
                else {
                    el.editor = new el.editor(self);
                    if(!(el.editor instanceof EditTable.AbstractEditor)) {
                        throw "Editor must be an instance of EditTable.AbstractEditor";
                    }
                }

                el.formatters = el.formatters || [];

                el.options = el.options || {};

                // If this cell's value needs to be re-calculated when other cells change
                if(el.watch && el.value) {
                    $.each(el.watch,function(j) {
                        self.on('set',function(cell, data) {
                            // If a specific cell was set
                            if(cell) {
                                if($.inArray(self.getColumn(cell),el.watch) > -1) {
                                    var target = self.getCell(self.getRow(cell), i);
                                    self.set(target,el.value(target));
                                }
                            }
                            // If the whole table changed
                            else {
                                // Get all cells in this column and update them
                                $("tr",self._table).slice(1).each(function(row) {
                                    var target = self.getCell(row+1, i);
                                    self.set(target,el.value(target));
                                });
                            }
                        });
                    });
                }
            });

            // Used to keep track of the current cell being edited
            this._current_cell = null;

            // The editor overlay
            this._editor_overlay = $("<div/>").css({
                display: 'none',
                background: 'white',
                opacity: '.8',
                position: 'absolute'
            }).appendTo('body');

            // Edit a cell when it's clicked
            this._table.on('click','td',function(e) {
                e.preventDefault();
                self.edit($(this));
            });

            window.setTimeout(function() {
                self.format();
                self.trigger('set');
            });
        },

        /**
         * Add an event listener
         * @param type The type of event
         * @param callback The callback function
         * @return this
         */
        on: function(type, callback) {
            this._events = this._events || {};
            this._events[type] = this._events[type] || [];

            // Add the event if it isn't already there
            if($.inArray(callback,this._events[type]) == -1) {
                this._events[type].push(callback);
            }

            return this;
        },

        /**
         * Remove an event listener
         * @param type The type of event.  If not set, all events will be removed
         * @param callback The callback function.  If not set, all events of the passed type will be removed
         * @return this
         */
        removeEvent: function(type, callback) {
            if(type) {
                if(!this._events || !this._events[type]) return this;
                // Removing a specific callback
                if(callback) {
                    var index = $.inArray(callback, this._events[type]);
                    if(index != -1) {
                        var rest = this._events[type].slice(index+1);
                        var before = index? this._events[type].slice(0,index) : [];

                        this._events[type] = before.concat(rest);
                    }
                }
                // Removing all events of a specific type
                else {
                    this._events[type] = [];
                }
            }
            // Removing all events
            else {
                this._events = {};
            }

            return this;
        },

        /**
         * Trigger an event.  Any other arguments passed to this function will be forwarded on to the callback
         * @param type The type of event to trigger
         * @return this
         */
        trigger: function(type) {
            var data = Array.prototype.slice.call(arguments).slice(1);
            var self = this;

            if(!this._events || !this._events[type]) return this;
            $.each(this._events[type],function(i,callback) {
                callback.apply(self, data);
            });

            return this;
        },

        /**
         * Apply formatters for a single table cell or the entire table.
         * @param [td] The table cell.  If null or undefined, the entire table will be formatted.
         */
        format: function(td) {
            // If formatting a single cell
            if(td) {
                var col = this.getColumn(td);
                if(this._columns[col] && this._columns[col].formatters) {
                    var data = this.get(td);
                    data = data.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

                    for(var i=0;i<this._columns[col].formatters.length; i++) {
                        // If a formatter object was given
                        if(this._columns[col].formatters[i] instanceof EditTable.AbstractFormatter) {
                            data = this._columns[col].formatters[i].format(data, td);
                        }
                        // If a function was given
                        else {
                            data = this._columns[col].formatters[i](data, td);
                        }
                    }
                    td.html(data);
                }

                this.trigger('format', td, col);
            }
            // If formatting entire table
            else {
                var self = this;
                $('td',this._table).each(function(i,el) {
                    self.format($(this));
                });
            }
        },

        /**
         * Gets the name of a column given a table cell
         * @param td The table cell
         * @return String the name of the column
         */
        getColumn: function(td) {
            if(!td.data('column')) {
                var i = td.prevAll('td').length;
                td.data('column',$("th",this._table).eq(i).text());
            }

            return td.data('column');
        },

        /**
         * Gets the row number given a table cell
         * @param td The table cell
         * @return Integer the row number (0 = header row)
         */
        getRow: function(td) {
            if(!td.data('row')) {
                td.data('row',td.parent('tr').prevAll('tr').length + 1);
            }

            return td.data('row');
        },

        getCell: function(row,col) {
            this._cell_cache = this._cell_cache || {};

            var key = row+","+col;

            if(!this._cell_cache[key]) {
                var col_num = $.inArray(col,this._column_order);

                if(col_num > -1) {
                    this._cell_cache[key] = $("td",$("tr",this._table).eq(row)).eq(col_num);
                }
            }

            return this._cell_cache[key];
        },

        /**
         * Saves the current editor's value to the table
         * @return this Makes the method chainable
         */
        save: function() {
            if(this._current_cell) {
                var editor = this._columns[this.getColumn(this._current_cell)].editor;
                var data = editor.getValue();
                this.set(this._current_cell, data);
            }

            return this;
        },
        /**
         * Closes and saves the current editor
         * @return this Makes the method chainable
         */
        stopEditing: function() {
            if(!this._current_cell) return this;

            // Column definition for this cell
            var col = this._columns[this.getColumn(this._current_cell)];

            if(col.disabled) return;

            col.editor.hide();
            this._editor_overlay.hide();

            if(this._stopping) return this;
            this._stopping = true;

            this.save();
            this.trigger('stop', this._current_cell);

            this._stopping = false;

            return this;
        },
        /**
         * Edit a table cell
         * @param td The td you want to edit
         * @return this Makes the method chainable
         */
        edit: function(td) {
            this.stopEditing();
            this._current_cell = td;

            // Determine which column this td belongs to
            var col = this.getColumn(td);
            if(!this._columns[col]) return;
            if(this._columns[col].disabled) return;

            var editor = this._columns[col].editor;
            var options = this._columns[col].options;
            var data = this.get(td);

            var pos = td.position();
            this._editor_overlay.css({
                top: pos.top,
                left: pos.left,
                width: td.outerWidth(),
                height: td.outerHeight(),
                'z-index': 9999
            }).show();

            // Start the editor
            editor.cell = td;
            editor.position(td);
            editor.show();
            editor.start(data, options);

            this.trigger('edit', td);

            return this;
        },
        /**
         * Move editing focus down to the cell below the current one
         * @return this Makes the method chainable
         */
        goDown: function() {
            if(!this._current_cell) return this;

            var i = this._current_cell.prevAll('td').length;
            var down = this._current_cell.parent('tr').next('tr').children('td').eq(i);

            if(down.length) {
                this.edit(down);
            }
            return this;
        },
        /**
         * Move editing focus up to the cell above the current one
         * @return this Makes the method chainable
         */
        goUp: function() {
            if(!this._current_cell) return this;

            var i = this._current_cell.prevAll('td').length;
            var up = this._current_cell.parent('tr').prev('tr').children('td').eq(i);

            if(up.length) {
                this.edit(up);
            }

            return this;
        },
        /**
         * Move editing focus left to the cell before the current one
         * @return this Makes the method chainable
         */
        goLeft: function() {
            if(!this._current_cell) return this;

            var prev = this._current_cell.prev('td');
            if(prev.length) {
                this.edit(prev);
            }
            else {
                prev = this._current_cell.parent('tr').prev('tr').children('td:last');
                if(prev.length) {
                    this.edit(prev);
                }
            }

            return this;
        },
        /**
         * Move editing focus right to the cell after the current one
         * @return this Makes the method chainable
         */
        goRight: function() {
            if(!this._current_cell) return this;

            var next = this._current_cell.next('td');
            if(next.length) {
                this.edit(next);
            }
            else {
                next = this._current_cell.parent('tr').next('tr').children('td:first');
                if(next.length) {
                    this.edit(next);
                }
            }

            return this;
        },
        set: function(td, data) {
            if(!td.length) return;

            td.text(data);
            td.data('value',td.text());

            // Apply any formatters
            this.format(td);

            this.trigger('set',td,data);
        },
        get: function(td) {
            if(!td.data('value')) {
                td.data('value',td.text());
            }

            return td.data('value');
        },
        /**
         * Get the rows as an array of JSON objects
         * @returns {Array} An array of JSON objects
         */
        getRows: function() {
            var rows = [];
            var self = this;
            $("tr",this._table).slice(1).each(function() {
                var row = {};
                $("td",$(this)).each(function(i) {
                    row[self._column_order[i]] = self.get($(this));
                });
                rows.push(row);
            });
            return rows;
        },
        /**
         * Set the table rows from an array of json objects
         * @param data An array of JSON objects, all in the same format
         * @returns this
         */
        setRows: function(data) {
            this._cell_cache = {};

            var table = this._table;
            table.html('');

            var order = this._column_order;

            var header = $("<tr></tr>");
            $.each(order,function() {
                header.append($("<th></th>").text(this));
            });
            table.append($("<thead></thead>").append(header));

            $.each(data,function(i,el) {
                var row = $("<tr></tr>").appendTo(table);
                $.each(order,function() {
                    var value = el[this] || '';

                    $("<td></td>").text(value).appendTo(row);
                });
            });

            this.format();
            this.trigger('set');

            return this;
        },
        /**
         * Add a
         * @param num The number of rows to add (defaults to 1)
         * @returns {*}
         */
        addRow: function(num) {
            num = num || 1;
            var cols = $("td,th",$("tr:first",this._table)).length;

            var row;
            for(var i=0; i<num; i++) {
                row = $("<tr></tr>").appendTo(this._table);
                for(var j=0; j<cols; j++) {
                    $("<td></td>").data('unformatted','').appendTo(row);
                }
            }

            this.format();

            this.trigger('add',num);

            return this;
        },
        removeRow: function(i) {
            // Remove the last row by default
            if(!i || i<1) {
                i = $("tr",this._table).length - 1;
            }
            if(i<1) return this;

            $("tr",this._table).eq(i).remove();

            this.trigger('remove',i);

            return this;
        }
    });

    EditTable.AbstractFormatter = Class.extend({
        init: function(options) {
            options = options || {};
            this.options = this.options || {};
            $.extend(this.options,options);
        },
        format: function(data, td) {
            return data;
        }
    });

    EditTable.BoldFormatter = EditTable.AbstractFormatter.extend({
        format: function(data) {
            return "<strong>"+data+"</strong>";
        }
    });

    EditTable.CssFormatter = EditTable.AbstractFormatter.extend({
        format: function(data, td) {
            if(this.options.class) {
                td.addClass(this.options.class);
            }
            if(this.options.css) {
                td.css(this.options.css);
            }

            return data;
        }
    });

    /**
     * All editors should extend this base class
     */
    EditTable.AbstractEditor = Class.extend({
        /**
         * Override in child classes if needed.
         * @constructor
         * @param edit_table The instance of EditTable this editor belongs to
         */
        init: function(edit_table) {
            this._edit_table = edit_table;

            this.element = this.createElement().css({
                'position': 'absolute',
                'display': 'none',
                'z-index': 99999
            }).appendTo('body');

            this.initEvents();
        },
        /**
         * Create the main editor element and return it
         * @return The editor DOM element
         */
        createElement: function() {
            return $('<input type="text"/>');
        },
        /**
         * Start any event listeners for the editor
         */
        initEvents: function() {
            var self = this;
            this.element.on('blur',function() {
                window.setTimeout(function() {
                    if(self.cell === self._edit_table._current_cell) self._edit_table.stopEditing();
                },50);
            });

            this.element.on('keydown',function(e) {
                // TAB
                if(e.which == 9) {
                    e.preventDefault();

                    // Shift+TAB
                    if(e.shiftKey) {
                        self._edit_table.goLeft();
                    }
                    // TAB
                    else {
                        self._edit_table.goRight();
                    }
                }
                // UP ARROW
                else if(e.which == 38) {
                    e.preventDefault();
                    self._edit_table.goUp();
                }
                // DOWN ARROW
                else if(e.which == 40) {
                    e.preventDefault();
                    self._edit_table.goDown();
                }
                // ENTER
                else if(e.which == 13) {
                    // If the shift key was also pressed, pass through to the input
                    // Otherwise, save the value and stop editing
                    if(!e.shiftKey) {
                        e.preventDefault();
                        self._edit_table.stopEditing();
                    }
                }
            })
        },
        /**
         * Starts the editor and sets the starting value
         * Override in child classes if needed
         * @param value The starting value for the editor
         * @param options An array of options
         */
        start: function(value, options) {
            this.element.val(value).focus();
        },
        /**
         * Gets the editor's value
         * Override in child classes if needed
         * @return The value of the editor
         */
        getValue: function() {
            return this.element.val();
        },
        /**
         * Position the editor relative to a td
         * Override in child classes if needed.
         * @param td The td tag to position the editor relative to
         */
        position: function(td) {
            var pos = td.position();

            // Fill the parent width, keep editor's height, vertically center
            var width = td.outerWidth();
            var height = this.element.outerHeight();
            var top = pos.top + (td.outerHeight() - height)/2;

            this.element.css({
                top: top,
                left: pos.left,
                width: width
            });
        },
        /**
         * Show the editor
         * Override in child classes if needed.
         */
        show: function() {
            this.element.show();
        },
        /**
         * Hide the editor
         * Override in child classes if needed.
         */
        hide: function() {
            this.element.hide();
        }
    });

    /**
     * A simple text input editor.
     */
    EditTable.TextEditor = EditTable.AbstractEditor.extend({
        start: function(value, options) {
            this.element.val(value).focus().select();
        }
    });

    /**
     * A Textarea editor
     */
    EditTable.LongTextEditor = EditTable.TextEditor.extend({
        createElement: function() {
            return $("<textarea></textarea>");
        },
        position: function(td) {
            var pos = td.position();

            // Fill the parent
            this.element.css({
                top: pos.top,
                left: pos.left,
                width: td.outerWidth(),
                height: td.outerHeight()
            });
        }
    });

    /**
     * A select box editor
     */
    EditTable.SelectEditor = EditTable.AbstractEditor.extend({
        createElement: function() {
            return $("<select/>");
        },
        start: function(value, options) {
            this.element.html('<option value=""></option>');

            var values = options.values || [];
            for(var i=0; i<values.length; i++) {
                this.element.append('<option value="'+values[i]+'">'+values[i]+'</option>');
            }

            this.element.val(value).focus();
        }
    });
})(jQuery);
