/**
 * EditTable is a jQuery plugin to make your HTML tables editable.
 * It has no dependencies (other than jQuery) and is easy to customize.
 *
 * @author     Jeremy Dorn <jeremy@jeremydorn.com>
 * @copyright  2013 Jeremy Dorn
 * @license    http://opensource.org/licenses/MIT
 * @link       http://github.com/jdorn/EditTable
 * @version    0.3.0
 */
(function($) {
  /**
   * Container for helper functions, default options, and editors
   */
  $.EditTable = {
    default_options: {
      columns: {},
      defaultEditor: "text",
      defaultOptions: {},
      tdClass: '',
      thClass: '',
      includeTBody: true,
      includeTHead: true,
      set: null,
      build: null
    },
    editors: {}
  };
  
  var methods = {
    /**
     * Constructor
     * @param options An options hash.
     * @constructor
     */
    init: function(options) { 
      var settings = $.extend(true, {}, $.EditTable.default_options, options);
      
      return this.each(function() {
        var data = {
          settings: settings,
          initialized: true,
          editors: {}
        };
        var $this = $(this);
        
        if(settings.set) $this.on('set.editTable',settings.set);
        if(settings.build) $this.on('build.editTable',settings.build);
        
        $this.data('editTable',data);
        $this.editTable('refresh');
        
        // Clicking on a cell starts the editor
        $this.on('click.editTable','td',function() {
          var cell = $(this).data('editTable');
          if(!cell) return;
          
          $this.editTable('edit', cell.row, cell.col);
        });
      });      
    },
    
    /**
     * Set or get one or more options
     * 
     * Usage 1 - Get single option
     * var value = el.editTable('option', 'key');
     * 
     * Usage 2 - Get multiple values
     * var values = el.editTable('option', ['key1','key2']);
     * console.log(values.key1, values.key2);
     * 
     * Usage 3 - Set single option
     * el.editTable('option', 'key', 'value');
     * 
     * Usage 4 - Set multiple options
     * el.editTable('option', { key1: 'value1', key2: 'value2' });
     */
    option: function(key,value) {
      // option({key: value})
      // set multiple options
      if($.type(key) === "object") {
        return this.each(function() {
          var $this = $(this);
          var data = $this.data('editTable');
          if(!data || !data.initialized) $.error('EditTable must be initialized before setting options');
          data.settings = $.extend(data.settings, key);
          
          if(key.set) $this.on('set.editTable',key.set);
          if(key.build) $this.on('build.editTable',key.build);
          
          $this.editTable('refresh');
        });
      }
      // option(['key1','key2'])
      // get multiple options
      else if($.type(key) === "array") {
        var ret = {};
        var $this = this.eq(0);
        var data = $this.data('editTable');
        if(!data || !data.initialized) $.error('EditTable must be initialized before getting options');
        $.each(key,function(i,k) {
          if(typeof data.settings[k] === 'undefined') $.error('Unknown option '+k);
          else ret[k] = data.settings[k];
        });
        return ret;
      }
      // option('key','value')
      // set single option
      else if(typeof value !== 'undefined') {
        return this.editTable('option',{key: value});
      }
      // option('key')
      // get single option
      else {
        return this.editTable('option',[key])[key];
      }
    },
    
    /**
     * Refreshes edit table to match the dom.
     * Should be called after manipulating the containing table 
     * DOM element or it's children.
     */
    refresh: function() {
      return this.each(function() {
        var $this = $(this);
        
        var data = $this.data('editTable');
        if(!data || !data.initialized) $.error("EditTable must be initialized before calling refresh");
        
        data.rows = [];
        data.cols = [];
        data.json = [];
        
        // Determine columns from first row
        $("td,th",$("tr",$this).eq(0)).each(function() {
          var colname = $.trim($(this).text());
          
          data.settings.columns[colname] = data.settings.columns[colname] || {};
          
          // If this column has a class applied
          if(data.settings.columns[colname].thClass) {
            $(this).addClass(data.settings.columns[colname].thClass);
          }
          if(data.settings.thClass) {
            $(this).addClass(data.settings.thClass);
          }
          
          data.cols.push(colname);
          
          // Determine the editor to use for this column
          var editor, editor_options;
          if(!data.settings.columns[colname].editor) {
            editor = data.settings.defaultEditor;
            editor_options = data.settings.defualtOptions;
          }
          else {
            editor = data.settings.columns[colname].editor;
            editor_options = data.settings.columns[colname].options || {};
          }
          
          if(!$.EditTable.editors[editor]) $.error("Unknown editor "+editor);
          data.editors[colname] = new $.EditTable.editors[editor]($this, editor_options);
        });
        // Determine row data from remaining rows
        $("tr",$this).slice(1).each(function() {
          var row = [];
          var json = {};
          var $row = $(this);
          
          $("td",$row).each(function() {
            var cell = {
              row: data.rows.length,
              col: row.length,
              colname: data.cols[row.length],
              value: $.trim($(this).text()),
              el: $(this)
            };
            
            // If this column has a class applied
            if(data.settings.columns[cell.colname].tdClass) {
              $(this).addClass(data.settings.columns[cell.colname].tdClass);
            }
            if(data.settings.tdClass) {
              $(this).addClass(data.settings.tdClass);
            }
            
            $(this).data('editTable',cell);
            row.push(cell);
            json[cell.colname] = cell.value;
          });
          
          data.rows.push(row);
          data.json.push(json);
        });
        
        $.each(data.rows,function() {
          $.each(this,function() {
            $this.editTable('set', this.row, this.col, this.value);
          });
        });
      });
    },
    
    /**
     * Get or set the table's rows.
     * 
     * Usage 1 - Get the rows as an array of JSON objects
     * var rows = el.editTable('rows');
     * 
     * Usage 2 - Set the rows from an array of JSON objects
     * var rows = [
     *  {col1: "value1", col2: "value2"},
     *  {col1: "value3", col2: "value4"}
     * ];
     * el.editTable('rows', rows);
     */
    rows: function(rows) {
      // Setting data
      if($.type(rows) === 'array' && rows.length) {
        return this.each(function() {
          var $this = $(this);
          
          var data = $this.data('editTable');
          if(!data || !data.initialized) $.error("EditTable must be initialized before calling json");
          
          $this.empty();
          
          var header_row = $("<tr></tr>")
          if(data.settings.includeTHead) {
            header_row.appendTo($("<thead></thead>").appendTo($this));
          }
          else {
            header_row.appendTo($this);
          }

          // Determine the headers
          var headers = [];
          $.each(rows[0],function(header) {
            headers.push(header);
            $("<th></th>").text(header).appendTo(header_row);
          });
          
          // Add each row
          var tbody = $this;
          if(data.settings.includeTBody) {
            tbody = $("<tbody></tbody>").appendTo($this);
          }
          $.each(rows,function(i,row) {
            var $row = $("<tr></tr>").appendTo(tbody);
            $.each(headers,function() {
              $("<td></td>").text(row[this] || '').appendTo($row);
            });
          });
          
          $this.editTable('refresh');
          $this.trigger('build.editTable');
        }); 
      }
      // Getting data
      else {
        // Make sure we're only operating on 1 table
        var $this = $(this).eq(0);
        
        var data = $this.data('editTable');
        if(!data || !data.initialized) $.error("EditTable must be initialized before calling json");
        
        // Do a deep copy so modifying this won't mess up the actual data
        var ret = [];
        $.each(data.json,function() {
          ret.push($.extend({},this));
        });
        return ret;
      }
    },
    
    /**
     * Start editing a cell.
     * @param row The row number of the cell starting at 0
     * @param col The column number or column name of the cell
     */
    edit: function(row, col) {
      var orig = $(this);
      
      // Make sure we're only operating on 1 table
      var $this = $(this).eq(0);
      
      var data = $this.data('editTable');
      if(!data || !data.initialized) $.error("EditTable must be initialized before calling edit");
      
      if(typeof col !== 'number') {
        col = $.inArray(col, data.cols);
      }
      
      if(!data.cols[col]) $.error("Unknown column "+col);
      if(!data.rows[row]) $.error("Invalid row "+row);
      if(!data.rows[row][col]) $.error("Invalid row and column");
      
      var cell = data.rows[row][col];
      
      // Determine the editor to use for this column
      data.current_cell = cell;
      
      // Stop all open editors
      $this.editTable('stop');
      
      // Don't start editing a disabled column
      if(data.settings.columns[cell.colname] && data.settings.columns[cell.colname].disabled) return orig;
      
      // Start editing the cell
      var called = false;
      data.editors[cell.colname].start(cell.el, cell.value, function(val) {
        if(called) return;
        called = true;
        
        // Save the value
        $this.editTable('set', cell.row, cell.col, val);
      });
      
      return orig;
    },
    
    /**
     * Stop editing cells in the table and close all editors
     */
    stop: function() {
      return this.each(function() {
        var $this = $(this);
        var data = $this.data('editTable');
        if(!data || !data.initialized) $.error("EditTable must be initialized before calling stop");
        
        $.each(data.editors,function(i,el) {
          el.stop();
        });
      });
    },
    
    /**
     * Set the value of a cell
     * @param row The row number of the cell starting at 0
     * @param col The column number or column name of the cell
     * @param value The value to set
     */
    set: function(row,col,value) {
      return this.each(function() {
        var $this = $(this);
        var data = $this.data('editTable');
        if(!data || !data.initialized) $.error("EditTable must be initialized before calling set");
        
        if(typeof col !== 'number') {
          col = $.inArray(col, data.cols);
        }
        
        if(!data.cols[col]) $.error("Unknown column "+col);
        if(!data.rows[row]) $.error("Invalid row "+row);
        if(!data.rows[row][col]) $.error("Invalid row and column");
        
        var cell = data.rows[row][col];
        cell.value = value;
        data.json[row][cell.colname] = value;
        
        cell.el.text(value);
        
        $this.trigger('set.editTable', {
          el: cell.el,
          col: cell.col,
          row: cell.row,
          colname: cell.colname,
          value: cell.value
        });
      });
    },
    
    /**
     * Get the value of a cell
     * @param row The row number of the cell starting at 0
     * @param col The column number or column name of the cell
     * @return The value
     */
    get: function(row,col) {
      // Make sure we're only operating on 1 table
      var $this = $(this).eq(0);
      
      var data = $this.data('editTable');
      if(!data || !data.initialized) $.error("EditTable must be initialized before calling edit");
      
      if(typeof col !== 'number') {
        col = $.inArray(col, data.cols);
      }
      
      if(!data.cols[col]) $.error("Unknown column "+col);
      if(!data.rows[row]) $.error("Invalid row "+row);
      if(!data.rows[row][col]) $.error("Invalid row and column");
      
      return data.rows[row][col];
    },
    
    /**
     * Change the cell that's currently being edited
     * @param direction One of 'left', 'right', 'up', or 'down'
     * @param amount The number of cells to move (defaults to 1)
     */
    move: function(direction, amount) {
      amount = amount || 1;
      
      return this.each(function() {
        var $this = $(this);
        var data = $this.data('editTable');
        if(!data || !data.initialized) $.error("EditTable must be initialized before calling move");
        
        var row = 0, col = 0;
        if(data.current_cell) {
          row = data.current_cell.row;
          col = data.current_cell.col;
          
          if(direction === 'left') col-=amount;
          else if(direction === 'right') col+=amount;
          else if(direction === 'up') row-=amount;
          else if(direction === 'down') row+=amount;
          else $.error("Unknown direction "+direction);
        }
        
        if(col < 0) {
          row --;
          col = data.cols.length + col;
          // TODO: this will break if going back more than data.cols.length
        }
        else if(col >= data.cols.length) {
          col = col - data.cols.length;
          row ++;
          // TODO; this will break if going forward more than data.cols.length
        }
        
        // Can't move further up
        if(row < 0) return;
        // Can't move further down
        // TODO: automatically create new row
        else if(row >= data.rows.length) return;
        
        // Skip over disabled cells
        if(data.settings.columns[data.cols[col]] && data.settings.columns[data.cols[col]].disabled) {
          
          $this.editTable('move', direction, amount+1);
        }
        else {
          $this.editTable('edit',row,col);
        }
      });
    },
    
    /**
     * Add blank row(s) to the table
     * @param num The number of rows to add (defaults to 1)
     */
    add: function(num) {
      return this.each(function() {
        var $this = $(this);
        var data = $this.data('editTable');
        if(!data || !data.initialized) $.error("EditTable must be initialized before calling add");
        
        num = num || 1;
        
        // Where we add the row(s) to
        var container = $("tbody",$this);
        if(container.length === 0) container = $this;
        
        for(var i=0; i<num; i++) {
          var row = $("<tr></tr>").appendTo(container);
          for(var j=0; j<data.cols.length; j++) {
            $("<td></td>").appendTo(row);
          }
        }
        
        $this.editTable('refresh');
      });
    },
    
    /**
     * Remove row from table
     * @param row The row to remove (starting at 0).  Defaults to last row in table.
     */
    remove: function(row) {
      return this.each(function() {
        var $this = $(this);
        var data = $this.data('editTable');
        if(!data || !data.initialized) $.error("EditTable must be initialized before calling remove");
        
        var i = row;
        if(typeof i === 'undefined') {
          i = data.rows.length - 1;
        }
        if(i < 0) i = 0;
        
        $("tr",$this).eq(i+1).remove();
        
        $this.editTable('refresh');
      });
    },
    
    /**
     * Remove all event listeners and DOM elements for the editor.
     */
    destroy: function() {
      return this.each(function() {
        var $this = $(this);
        
        // If it's already been destroyed
        if(!$this.data('editTable')) return;
        
        // Stop any currently running editors
        $.each($this.data('editTable').editors,function() {
          this.stop();
        });
        
        // Remove data and event listeners
        $("td",$this).each(function() {          
          $(this).removeData('editTable');
        });
        $this.off('.editTable');
        $this.removeData('editTable');
      });
    }
  };

  $.fn.editTable = function( method ) {
    // Method calling logic
    if ( methods[method] ) {
      return methods[ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));
    } else if ( typeof method === 'object' || ! method ) {
      return methods.init.apply( this, arguments );
    } else {
      $.error( 'Method ' +  method + ' does not exist on jQuery.editTable' );
    }
  };
  
  // Helper methods for editors
  $.EditTable.helpers = {
    /**
     * Horizontally center an editor over a table cell and match the cell's height
     * @param editor_el The editor element
     * @param td The table cell element
     */
    centerX: function(editor_el, td) {
      var pos = td.position();

      // Fill the parent height, keep editor's width, horizontally center
      var height = td.outerHeight();
      var width = editor_el.outerWidth();
      var left = pos.left + (td.outerWidth() - width)/2;

      editor_el.css({
        position: 'absolute',
        top: pos.top,
        left: left,
        height: height
      });
    },
    /**
     * Vertically center an editor over a table cell and match the cell's width
     * @param editor_el The editor element
     * @param td The table cell element
     */
    centerY: function(editor_el,td) {
      var pos = td.position();

      // Fill the parent width, keep editor's height, vertically center
      var width = td.outerWidth();
      var height = editor_el.outerHeight();
      var top = pos.top + (td.outerHeight() - height)/2;

      editor_el.css({
        position: 'absolute',
        top: top,
        left: pos.left,
        width: width
      });
    },
    /**
     * Vertically and horizontally center an editor over a table cell
     * @param editor_el The editor element
     * @param td The table cell element
     */
    center: function(editor_el,td) {
      var pos = td.position();

      // Keep editor's width and height, vertically and horizontally center
      var width = editor_el.outerWidth();
      var height = editor_el.outerHeight();
      var top = pos.top + (td.outerHeight() - height)/2;
      var left = pos.left + (td.outerWidth() - width)/2;

      editor_el.css({
        position: 'absolute',
        top: top,
        left: left
      });
    },
    /**
     * Make an editor fully obscure a table cell
     * @param editor_el The editor element
     * @param td The table cell element
     */
    fill: function(editor_el,td) {
      var pos = td.position();

      // Fill the parent
      editor_el.css({
        position: 'absolute',
        top: pos.top,
        left: pos.left,
        width: td.outerWidth(),
        height: td.outerHeight()
      });
    },
    /**
     * Add keyboard navigation events to hook up tab/arrow keys.
     * @param editor_el The editor element
     * @param editTable The editTable element
     * @param preserve_arrows If true, up/down arrow navigation will require the shift key.
     */
    addKeyboardNavigation: function(editor_el, editTable, preserve_arrows) {      
      editor_el.on('keydown',function(e) {
        // TAB
        if(e.which == 9) {
          e.preventDefault();

          // Shift+TAB
          if(e.shiftKey) {
            editTable.editTable('move','left');
          }
          // TAB
          else {
            editTable.editTable('move','right');
          }
        }
        // UP ARROW
        else if(e.which == 38) {
          if(!preserve_arrows || e.shiftKey) {
            e.preventDefault();
            editTable.editTable('move','up');
          }
        }
        // DOWN ARROW
        else if(e.which == 40) {
          if(!preserve_arrows || e.shiftKey) {
            e.preventDefault();
            editTable.editTable('move','down');
          }
        }
      });
    }
  };
  
  // Pre-defined Editors
  // You can add your own as needed
  // Each editor class needs a 'start' and 'stop' function.
  
  /**
   * Text area editor.  This is the default editor.
   */
  $.EditTable.editors.text = function(editTable, options) {
    this.editTable = editTable;
    
    var self = this;
    this.start = function(el, value, callback) {
      if(self.el) self.stop();
      
      self.callback = callback;
      
      self.el = $("<textarea></textarea>")
        .appendTo(document.body)
        .val(value);
      
      // Hook up tabs/arrow keys events to editor element
      $.EditTable.helpers.addKeyboardNavigation(self.el, self.editTable);
      
      // Position editor element over table cell
      $.EditTable.helpers.fill(self.el, el);
      
      self.el.focus().select();
      
      // Hook up blur/enter events
      self.el.on('blur',function() {
        self.stop();
      });
      self.el.on('keydown',function(e) {
        if(e.which == 13) {
          // If the shift key was also pressed, pass through to the input
          // Otherwise, save the value and stop editing
          if(!e.shiftKey) {
            e.preventDefault();
            self.stop();
          }
        }
      });
    };
    
    this.stop = function() {
      if(!self.el) return;
      var temp = self.el;
      self.el = null;
      
      if(self.callback) self.callback(temp.val());
      temp.remove();
    };
  };
  
  /**
   * Select box editor.
   */
  $.EditTable.editors.select = function(editTable, options) {
    this.editTable = editTable;
    
    // If options is an array, convert to object
    if($.type(options.values) === 'array') {
      var temp = {};
      $.each(options.values,function(k,v) {
        temp[v] = v;
      });
      options.values = temp;
    }
    
    if($.type(options.values) !== 'object') $.error("Invalid select options");
    
    this.options = options.values;
    
    var self = this;
    this.start = function(el, value, callback) {
      if(self.el) self.stop();
      
      self.callback = callback;
      self.el = $("<select></select>").appendTo(document.body);
      
      $.each(self.options,function(k,v) {
        self.el.append($("<option></option>").attr('value',k).text(v));
      });
      
      self.el.val(value);
        
      // Hook up tabs/arrow keys events to editor element
      $.EditTable.helpers.addKeyboardNavigation(self.el, self.editTable, true);
      
      // Position editor element over table cell
      $.EditTable.helpers.centerY(self.el, el);
      
      self.el.focus();
      
      // Hook up blur/enter events
      self.el.on('blur',function() {
        self.stop();
      });
      self.el.on('keydown',function(e) {
        if(e.which == 13) {
          e.preventDefault();
          self.stop();
        }
      });
    };
    
    this.stop = function() {
      if(!self.el) return;
      var temp = self.el;
      self.el = null;
      
      if(self.callback) self.callback(temp.val());
      temp.remove();
    };
  };
  
})(jQuery);
