/**
 * Lấy query dựa theo input
 * @param query
 * @param input
 */
exports.parseQuery = function (query, input) {
  input = decodeURIComponent(input);
  var object = this.parseObject(input);
  return this.parseQueryFromObject(query, object);
};

exports.parseObject = function (input) {
  var checkHasQuery = input.split('?');
  if (typeof checkHasQuery[1] !== 'undefined') {
    input = checkHasQuery[1];
    var arrInput = input.split('&');
    var myObject = {};
    var fieldName = '';
    for (var i = 0; i < arrInput.length; i++) {
      var idx = arrInput[i].indexOf('=');
      if (idx > 0) {
        fieldName = arrInput[i].substring(0, idx);
        myObject[fieldName] = this.stringToObject(arrInput[i].substring(idx + 1), true, fieldName);
      }
    }

    return myObject;
  }

  return null;
};

exports.stringToObject = function (input, isFirst, type) {
  var idxField = input.indexOf('{');
  var idxElement = input.indexOf(',');
  var myObject = {};
  if (idxField > 0 && (idxField < idxElement || idxElement < 0)) {//{}
    var fieldName = input.substring(0, idxField);
    var idxCloseField = -1;//input.indexOf('}');
    var idxtmpOpenField = idxField + 1;
    var countCloseField = 0, countOpenField = 1;
    do {
      idxtmpOpenField = idxCloseField > 0 ? idxCloseField + 1 : idxtmpOpenField;
      idxCloseField = input.indexOf('}', idxtmpOpenField);
      countCloseField++;
      countOpenField += input.substring(idxtmpOpenField, idxCloseField).split('{').length - 1;
    } while (idxCloseField > 0 && countCloseField < countOpenField);
    if (idxCloseField == -1)
      idxCloseField = idxtmpOpenField - 1;
    myObject[fieldName] = {'fields': this.stringToObject(input.substring(idxField + 1, idxCloseField))};
    if (idxCloseField + 1 < input.length) {
      input = input.substring(idxCloseField + 1);
      //process method (.) subObject[fieldName]["page"]
      var idxMethodpage = input.indexOf('.');
      while (idxMethodpage == 0) {
        var idxMethodName1 = input.indexOf('(');
        var idxMethodName2 = input.indexOf('{');
        var methodName = '';
        if (0 < idxMethodName1 && (idxMethodName1 < idxMethodName2 || idxMethodName2 < 0)) {
          methodName = input.substring(1, idxMethodName1);
          myObject[fieldName][methodName] = input.substring(idxMethodName1 + 1, input.indexOf(')'));
          input = input.substring(input.indexOf(')') + 1);
        }
        else if (idxMethodName2 > 0 && (idxMethodName1 > idxMethodName2 || idxMethodName1 < 0)) {
          methodName = input.substring(1, idxMethodName2);
          myObject[fieldName][methodName] = this.stringToObject(input.substring(idxMethodName2 + 1, input.indexOf('}')));
          input = input.substring(input.indexOf('}') + 1);
        }
        idxMethodpage = input.indexOf('.');
      }

      if (input != '') {
        //No method -> nextElement
        if (input.indexOf(',') == 0) {
          input = input.substring(1);
        }
        return Object.assign(myObject, this.stringToObject(input));
      }
    }
    return myObject;
  }
  else if (idxElement > 0 && (idxField > idxElement || idxField < 0)) { //,
    myObject[input.substring(0, idxElement)] = null;
    var subResult = this.stringToObject(input.substring(idxElement + 1));
    return Object.assign(myObject, subResult);
  }
  else {
    if (isFirst == true && (type == 'page' || type == 'per_page')) {
      return input;
    }

    myObject[input] = null;
    return myObject;
  }
};

/**
 *
 * @param query
 * @param object
 * @returns {*}
 */
exports.parseQueryFromObject = function (query, object) {
  if (object != null) {
    for (var key in object) {
      if (!object.hasOwnProperty(key)) continue;

      if (key == 'fields') {
        var select = this.getSelect(object['fields']);
        var populate = this.getPopulate(object['fields']);
        if (select != null) {
          query.select(select);
        }
        if (populate.length) {
          query.populate(populate);
        }
      } else if (key == 'sort') {
        var sort = this.getSort(object['sort']);
        if (!this.isEmptyObject(sort)) {
          query.sort(sort);
        }
      } else if (key == 'q') {
        var wheres = this.getMatch(object['q']);
        if (wheres != null) {
          for (var i = 0; i < wheres.length; i++) {
            var where = wheres[i];
            if (where != null) {
              query.where(where);
            }
          }
        }
      }
    }
  }
};

exports.getFields = function (object) {
  var fields = [];

  for (var key in object) {
    if (!object.hasOwnProperty(key)) continue;
    if (key == 'all' || key == '*') {
      return [];
    }

    fields.push(key);
  }

  return fields;
};

/**
 * Lấy các field trong query
 * @param object
 * @returns {*}
 */
exports.getSelect = function (object) {
  var fields = this.getFields(object);
  if (fields.length) {
    var select = fields.join(' ');
    return select;
  }

  return null;
};

/**
 * Lấy các sort trong query
 * @param object
 * @returns {*}
 */
exports.getSort = function (object) {
  var sort = {};

  for (var key in object) {
    if (!object.hasOwnProperty(key)) continue;

    var tmp = key.split(':');
    if (tmp.length > 1) {
      sort[tmp[0]] = tmp[1];
    }
  }

  return sort;
};

/**
 * Lấy các populate trong query
 * @param object
 * @returns {Array}
 */
exports.getPopulate = function (object) {
  var populates = [];
  for (var key in object) {
    if (!object.hasOwnProperty(key)) continue;

    if (object[key] != null) {
      var select = this.getSelect(object[key]['fields']);
      var subPopulate = this.getPopulate(object[key]['fields']);
      var populate = {
        path: key
      };

      if (select != null) {
        populate['select'] = select;
      }

      if (subPopulate.length) {
        populate['populate'] = subPopulate;
      }

      var match = this.getMatch(object[key]['q']);
      if (match != null) {
        populate['match'] = match;
      }

      var options = {};
      var limit = object[key]['per_page'];
      if (limit != null) {
        options['limit'] = limit;
        var page = object[key]['page'];
        options['skip'] = limit * (page - 1);
      }

      var sort = this.getSort(object[key]['sort']);
      if (!this.isEmptyObject(sort)) {
        options['sort'] = sort;
      }
      populate['options'] = options;

      populates.push(populate);
    }
  }

  return populates;
};

exports.getMatch = function (input) {
  if (input != null) {
    var arr = [];
    for (var key in input) {
      var object = {};
      if (!input.hasOwnProperty(key)) continue;
      var parse_operator_result = this.parseOperator(key);
      if (parse_operator_result != null) {
        var field = parse_operator_result["field"];
        var value = parse_operator_result["value"];
        value = value.replace(/\+/g, ' ');

        var reISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*))(?:Z|(\+|-)([\d|:]*))?$/;
        if (reISO.exec(value)) {
          value = new Date(value);
        }

        var operator = parse_operator_result["operator"];

        if (operator == '*' || operator == '^' || operator == '$') {
          var cond = '';
          if (operator == '*') {
            cond = new RegExp(value, 'i');
          } else if (operator == '^') {
            cond = new RegExp('^' + value + '.*', 'i');
          } else {
            cond = new RegExp('.*' + value + '$', 'i');
          }
        } else if (operator == '$in') {
          value = value.split('|');
          var cond = {};
          cond[operator] = value;
        } else {
          var cond = {};
          cond[operator] = value;
        }
        object[field] = cond;
        arr.push(object);
      }
    }

    return arr;
  }

  return null;
};

exports.parseOperator = function (input) {
  var operators = {
    '>=': '$gte',
    '>': '$gt',
    '<=': '$lte',
    '<': '$lt',
    '!=': '$ne',
    '=': '$eq',
    '::': '$in',
    ':': '$eq',
    '*': '*',
    '^': '^',
    '$': '$'
  };

  for (var key in operators) {
    if (!operators.hasOwnProperty(key)) continue;

    var tmp_operator = input.split(key);
    if (tmp_operator.length > 1) {
      var field = tmp_operator[0];
      var value = tmp_operator[1];
      var operator = operators[key];
      return {field: field, value: value, operator: operator};
    }
  }

  return null;
};

exports.isEmptyObject = function (obj) {
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return false;
    }
  }
  return true;
};