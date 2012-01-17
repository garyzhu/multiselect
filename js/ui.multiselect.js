/*
 * jQuery UI Multiselect
 *
 * Authors:
 *  Michael Aufreiter (quasipartikel.at)
 *  Yanick Rochon (yanick.rochon[at]gmail[dot]com)
 *
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 *
 * http://www.quasipartikel.at/multiselect/
 *
 *
 * Depends:
 *	ui.core.js
 *	ui.sortable.js
 *
 * Optional:
 * localization (http://plugins.jquery.com/project/localisation)
 * scrollTo (http://plugins.jquery.com/project/ScrollTo)
 *
 * Todo:
 *  Make batch actions faster
 *  Implement dynamic insertion through remote calls
 */


(function($) {

$.widget("ui.multiselect", {
  options: {
		sortable: true,
		dragToAdd: true,
		searchable: true,
		doubleClickable: true,
		animated: 'fast',
		show: 'slideDown',
		hide: 'slideUp',
		dividerLocation: 0.6,
		selectedContainerOnLeft: true,
		width: null,
		height: null,
		nodeComparator: function(node1,node2) {
			var text1 = node1.text(),
			    text2 = node2.text();
			return text1 == text2 ? 0 : (text1 < text2 ? -1 : 1);
		},
		includeRemoveAll: true,
		includeAddAll: true
	},
	_create: function() {
		this.element.hide();
		this.id = this.element.attr("id");
		this.container = $('<div class="ui-multiselect ui-helper-clearfix ui-widget"></div>').insertAfter(this.element);
		this.count = 0; // number of currently selected options
		this.selectedContainer = $('<div class="selected"></div>');
		if (this.options.selectedContainerOnLeft) {
			this.selectedContainer.appendTo(this.container);
			this.availableContainer = $('<div class="available"></div>').appendTo(this.container);
			this.availableContainer.addClass('right-column');
		}
		else
		{
			this.availableContainer = $('<div class="available"></div>').appendTo(this.container);
			this.selectedContainer.appendTo(this.container);
			this.selectedContainer.addClass('right-column');
		}
		this.selectedActions = $('<div class="actions ui-widget-header ui-helper-clearfix"><span class="count">0 '+$.ui.multiselect.locale.itemsCount+'</span>'+(this.options.includeRemoveAll?'<a href="#" class="remove-all">'+$.ui.multiselect.locale.removeAll+'</a>':'<span class="remove-all">&nbsp;</span>')+'</div>').appendTo(this.selectedContainer);
		this.availableActions = $('<div class="actions ui-widget-header ui-helper-clearfix"><input type="text" class="search empty ui-widget-content ui-corner-all"/>'+(this.options.includeAddAll?'<a href="#" class="add-all">'+$.ui.multiselect.locale.addAll+'</a>':'<span class="add-all">&nbsp;</span>')+'</div>').appendTo(this.availableContainer);
		this.selectedList = $('<ul class="selected connected-list"></ul>').appendTo(this.selectedContainer);
		this.availableList = $('<ul class="available connected-list"></ul>').appendTo(this.availableContainer);

		var that = this;

		var width = this.options.width;
		if (!width) {
			width = this.element.width();
		}
		var height = this.options.height;
		if (!height) {
			height = this.element.height();
		}

		// set dimensions
		this.container.width(width-2);
		if (this.options.selectedContainerOnLeft) {
			this.selectedContainer.width(Math.floor(width*this.options.dividerLocation)-1);
			this.availableContainer.width(Math.floor(width*(1-this.options.dividerLocation))-2);
		}
		else
		{
			this.selectedContainer.width(Math.floor(width*this.options.dividerLocation)-2);
			this.availableContainer.width(Math.floor(width*(1-this.options.dividerLocation))-1);
		}

		// fix list height to match <option> depending on their individual header's heights
		this.selectedList.height(Math.max(height-this.selectedActions.height(),1));
		this.availableList.height(Math.max(height-this.availableActions.height(),1));
		
		this._registerHoverEvents(this.container);
		this._registerDoubleClickEvents(this.container);
		this._registerAddEvents(this.availableList);
		this._registerRemoveEvents(this.selectedList);
		
		if ( !this.options.animated ) {
			this.options.show = 'show';
			this.options.hide = 'hide';
		}

		// init lists
		this._populateLists(this.element.find('option'));

		// make selection sortable
		if (this.options.sortable) {
			this.selectedList.sortable({
				placeholder: 'ui-state-highlight',
				axis: 'y',
				update: function(event, ui) {
					// apply the new sort order to the original selectbox
					that.selectedList.find('li').each(function() {
						if ($(this).data('optionLink'))
							$(this).data('optionLink').remove().appendTo(that.element);
					});
				},
				beforeStop: function (event, ui) {
					// This lets us recognize which item was just added to
					// the list in receive, per the workaround for not being
					// able to reference the new element.
					if (ui.item.hasClass('ui-draggable'))
						ui.item.addClass('dropped');
				},
				receive: function(event, ui) {
					ui.item.data('optionLink').attr('selected', true);
					// increment count
					that.count += 1;
					that._updateCount();
					// workaround, because there's no way to reference
					// the new element, see http://dev.jqueryui.com/ticket/4303
					that.selectedList.children('.dropped').each(function() {
						$(this).replaceWith(ui.item);
						that._applyItemState(ui.item, true);
					});

					// workaround according to http://dev.jqueryui.com/ticket/4088
					setTimeout(function() { ui.item.draggable("destroy"); }, 1);
				},
				stop: function (event, ui) { that.element.change(); }
			});
		}

		// set up livesearch
		if (this.options.searchable) {
			this._registerSearchEvents(this.availableContainer.find('input.search'));
		} else {
			$('.search').hide();
		}

		// batch actions
		this.container.find(".remove-all").click(function() {
			var f = document.createDocumentFragment();
			that.selectedList.children('li').each(function(i) {
				f.appendChild(this);
			});
			if (f.hasChildNodes()){
				var nodes = f.childNodes, 
				    len = nodes.length;
				for(var i=0; i<len; i++){
	   				var item = $(nodes[i]);
   					that._applyItemState(item, false);
   					item.data('optionLink').attr('selected', false);
   				}
               	that.count -= len;
       			that._updateCount();
       			that.availableList.append(f);
       			that.element.trigger('change');
			}
			return false;
		});

		this.container.find(".add-all").click(function() {
			var f = document.createDocumentFragment();
			that.availableList.children('li:visible').each(function(i) {
				f.appendChild(this);
			});
			if (f.hasChildNodes()){
				var nodes = f.childNodes, 
				    len = nodes.length;
				for(var i=0; i<len; i++){
    				var item = $(nodes[i]);
    				if (item.hasClass("ui-draggable"))
    					item.draggable("destroy");
    				that._applyItemState(item, true);
    				item.data('optionLink').attr('selected', true);
	            }
               	that.count += len;
       			that._updateCount();
       			that.selectedList.append(f);
       			that.element.trigger('change');
			}
			return false;
		});
	},
	destroy: function() {
		this.element.show();
		this.container.remove();

		$.Widget.prototype.destroy.apply(this, arguments);
	},
	addOption: function(option) {
		// Append the option
		option = $(option);
		var select = this.element;
		select.append(option);

		var item = this._getOptionNode(option).appendTo(option.attr('selected') ? this.selectedList : this.availableList).show();

		if (option.attr('selected')) {
			this.count += 1;
		}
		this._applyItemState(item, option.attr('selected'));
		item.data('idx', this.count);

		// update count
		this._updateCount();
		this._filter.apply(this.availableContainer.find('input.search'), [this.availableList]);
	},
    // Redisplay the lists of selected/available options.
    // Call this after you've selected/unselected some options programmatically.
    // GRIPE This is O(n) where n is the length of the list - seems like
    // there must be a smarter way of doing this, but I have not been able
    // to come up with one. I see no way to detect programmatic setting of
    // the option's selected property, and without that, it seems like we
    // can't have a general-case listener that does its thing every time an
    // option is selected.
    refresh: function() {
		// Redisplay our lists.
		this._populateLists(this.element.find('option'));
    },
	_populateLists: function(options) {
		this.selectedList.children('.ui-element').remove();
		this.availableList.children('.ui-element').remove();
		this.count = 0;

		var that = this, 
		    selectedFrag = document.createDocumentFragment(),
		    availableFrag = document.createDocumentFragment();
		
		options.each(function(index) {
			var item;
			if (this.selected){
				that.count += 1;
				if (that.options.sortable)
					item = $('<li class="ui-state-default ui-element" title="'+this.text+'"><span class="ui-icon ui-icon-arrowthick-2-n-s"/>'+this.text+'<a href="#" class="action"><span class="ui-corner-all ui-icon ui-icon-minus"/></a></li>');
				else 
					item = $('<li class="ui-state-default ui-element" title="'+this.text+'"><span class="ui-icon ui-helper-hidden"/>'+this.text+'<a href="#" class="action"><span class="ui-corner-all ui-icon ui-icon-minus"/></a></li>');
				selectedFrag.appendChild(item[0]);
			}else {
				item = $('<li class="ui-state-default ui-element" title="'+this.text+'"><span class="ui-helper-hidden"/>'+this.text+'<a href="#" class="action"><span class="ui-corner-all ui-icon ui-icon-plus"/></a></li>');
				availableFrag.appendChild(item[0]);
			}
			item.data({'optionLink': $(this), 'idx': index});
		});
        that.selectedList.append(selectedFrag);
        that.availableList.append(availableFrag);
      	that._updateCount();
       	that._filter.apply(that.availableContainer.find('input.search'), [that.availableList]);
	},
	_updateCount: function() {
		this.selectedContainer.find('span.count').text(this.count+" "+$.ui.multiselect.locale.itemsCount);
	},
	_getOptionNode: function(option) {
		option = $(option);
		var node = $('<li class="ui-state-default ui-element" title="'+option.text()+'"><span class="ui-icon"/>'+option.text()+'<a href="#" class="action"><span class="ui-corner-all ui-icon"/></a></li>').hide();
		node.data('optionLink', option);
		return node;
	},
	// clones an item with associated data
	// didn't find a smarter away around this
	_cloneWithData: function(clonee) {
		var clone = clonee.clone(false,false);
		clone.data({'optionLink': clonee.data('optionLink'),
					'idx': clonee.data('idx')
		});
		return clone;
	},
	_setSelected: function(item, selected) {
		var temp = item.data('optionLink').attr('selected', selected);
		var that = this, parent = temp.parent();
		temp.detach().appendTo(parent);
		this.element.trigger('change');

		if (selected) {
			item[this.options.hide](
				this.options.animated, 
				function() {
					that._applyItemState($(this).appendTo(that.selectedList)[that.options.show](that.options.animated).draggable("destroy"), true);
				}
			);
		} else {

			// look for successor based on initial option index
			var items = this.availableList.find('li'), comparator = this.options.nodeComparator;
			var succ = null, i = item.data('idx'), direction = comparator(item, $(items[i]));

			// TODO: test needed for dynamic list populating
			if ( direction ) {
				while (i>=0 && i<items.length) {
					direction > 0 ? i++ : i--;
					if ( direction != comparator(item, $(items[i])) ) {
						// going up, go back one item down, otherwise leave as is
						succ = items[direction > 0 ? i : i+1];
						break;
					}
				}
			} else {
				succ = items[i];
			}

			item[this.options.hide](
				this.options.animated, 
				function() {
					succ ? $(this).detach().insertBefore($(succ)) : $(this).detach().appendTo(that.availableList);
					$(this)[that.options.show](that.options.animated);
				}
			);
			this._applyItemState(item, false);
			return item;
		}
	},
	_applyItemState: function(item, selected) {
		if (selected) {
			if (this.options.sortable)
				item.children('span').removeClass('ui-helper-hidden').addClass('ui-icon-arrowthick-2-n-s ui-icon');
			else
				item.children('span').removeClass('ui-icon ui-icon-arrowthick-2-n-s').addClass('ui-helper-hidden');
			item.find('a.action span').removeClass('ui-icon-plus').addClass('ui-icon-minus');
		} else {
			item.children('span').removeClass('ui-icon ui-icon-arrowthick-2-n-s').addClass('ui-helper-hidden');
			item.find('a.action span').removeClass('ui-icon-minus').addClass('ui-icon-plus');
		}
		item.removeClass('ui-state-hover');
	},
	// taken from John Resig's liveUpdate script
	_filter: function(list) {
		var input = $(this);
		var term = $.trim(input.val().toLowerCase()), scores = [];
		var rows = list.children('li'),
			cache = rows.map(function(){

				return $(this).text().toLowerCase();
			});

		if (!term) {
			rows.show();
		} else {
			rows.hide();

			cache.each(function(i) {
				if (this.indexOf(term)>-1) { scores.push(i); }
			});

			$.each(scores, function() {
				$(rows[this]).show();
			});
		}
	},
	_registerDoubleClickEvents: function(container) {
		var that = this;
		container.delegate("li.ui-element", "dblclick", function(e){
			if (!that.options.doubleClickable) return;
			$(this).find('a.action').click();
		});
	},
	_registerHoverEvents: function(container) {
		container.delegate("li.ui-element", "mouseover mouseout", function(e){
			if (e.type == 'mouseover') {
				$(this).addClass('ui-state-hover');
			}else {
				$(this).removeClass('ui-state-hover');
			}
		});
	},
	_registerAddEvents: function(availableList) {
		var that = this;
		availableList.delegate("a.action", "click", function(e){
			var parent = $(this).parent();
			if (!parent.is(":animated")){ // skip, if another operation is ready in progress. 
				that._setSelected(parent, true);
				that.count += 1;
				that._updateCount();
			}
			return false;
		});
		if (that.options.sortable && that.options.dragToAdd) {
			availableList.delegate("li.ui-element:not(.ui-draggable)", "mouseover", function(e){
				// make draggable
		  		$(this).draggable({
		  			connectToSortable: that.selectedList,
		  			helper: function() {
		  				// helper: "clone", doesn't get the correct width
		  				// until you drag the clone into the selectedList.
		  				return $(this).clone().width($(this).width());
		  			},
		  			appendTo: that.container,
		  			containment: that.container,
		  			revert: 'invalid'
		  	    });

			});
		}
	},
	_registerRemoveEvents: function(selectedList) {
		var that = this;
		selectedList.delegate("a.action", "click", function(e){
			var parent = $(this).parent();
			if (!parent.is(":animated")){ // skip, if another operation is ready in progress. 
				that._setSelected($(this).parent(), false);
				that.count -= 1;
				that._updateCount();
			}
			return false;
		});
 	},
	_registerSearchEvents: function(input) {
		var that = this;

		input.focus(function() {
			$(this).addClass('ui-state-active');
		})
		.blur(function() {
			$(this).removeClass('ui-state-active');
		})
		.keypress(function(e) {
			if (e.keyCode == 13)
				return false;
		})
		.keyup(function() {
			that._filter.apply(this, [that.availableList]);
		});
	}
});

$.extend($.ui.multiselect, {
	locale: {
		addAll:'Add all',
		removeAll:'Remove all',
		itemsCount:'items selected'
	}
});


})(jQuery);
