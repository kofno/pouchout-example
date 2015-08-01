/* global: ko */
(function() {
  'use strict';

  var ENTER_KEY = 13;

  var local = new PouchDB('todos');
  var remote = 'http://127.0.0.1:5984/todos';

  ko.bindingHandlers.enterKey = {
    init: function(element, valueAccessor) {
      element.addEventListener('keyup', function(event) {
        if (event.keyCode === ENTER_KEY) {
          valueAccessor().call(this, event);
          return false;
        }
        return true;
      });
    }
  };

  function createTodoFromDoc(result) {
    return new Todo(result.doc);
  }

  function unko(model) {
    return {
      title: model.title(),
      completed: model.completed(),
      _id: model._id(),
      _rev: model._rev()
    };
  }

  function Todo(data) {
    this.title = ko.observable();
    this.completed = ko.observable();
    this._id = ko.observable();
    this._rev = ko.observable();

    this.editing = ko.observable(false);

    this.edit = function() {
      this.editing(true);
    }.bind(this);

    if (data) {
      this.title(data.title);
      this.completed(data.completed || false);
      this._id(data._id);
      this._rev(data._rev);
    }
  }

  function TodosModel() {
    this.newTodo = ko.observable();
    this.allTodos = ko.observableArray();
    this.synching = ko.observable(false);

    this.add = function() {
      var todo = {
        _id: new Date().toISOString(),
        title: this.newTodo(),
        completed: false
      };

      local.put(todo).then(function(result) {
        return console.log("Adding a new todo:", todo);
      })
      .then(function(result) {
        return this.newTodo(null);
      }.bind(this))
      .catch(console.log.bind(console));
    }.bind(this);

    this.updateTodos = function() {
      local.allDocs({
        include_docs: true,
        descending: true
      })
      .then(function(docs) {
        var todos = docs.rows.map(createTodoFromDoc);
        this.allTodos(todos);
      }.bind(this))
      .catch(console.log.bind(console));
    }.bind(this);

    this.saveTodo = function(todoM) {
      local.put(unko(todoM))
      .then(function(data) {
        console.log("Updated todo:", data);
      })
      .catch(console.log.bind(console));

      return true;
    }.bind(this);

    this.updateTodo = function(todoM) {
      console.log("updating:", todoM);
      if (todoM.title().trim().length === 0) {
        this.removeTodo(todoM);
      }
      else {
        this.saveTodo(todoM);
        todoM.editing(false);
      }
    }.bind(this);

    this.removeTodo = function(todoM) {
      local.remove(unko(todoM))
      .then(function(data) {
        console.log("Removed todo:", data);
      })
      .catch(console.log.bind(console));

      return true;
    }.bind(this);

    local.changes({
      since: 'now',
      live: true
    }).on('change', this.updateTodos);

    this.updateTodos();

    local.sync(remote, {
      live: true,
      retry: true
    })

    .on('active', function() {
      this.synching(true);
    }.bind(this))

    .on('paused', function() {
      this.synching(false);
    }.bind(this))

    .on('error', function(err) {
      console.log(err);
      this.synching(false);
    }.bind(this));

  }

  var vm = new TodosModel();
  ko.applyBindings(vm);

  window.vm = vm;
})();
