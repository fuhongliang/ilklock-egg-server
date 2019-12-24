
'use strict';

const sqlparser = require('node-sqlparser');
const moment = require('moment');

module.exports = {
  arrayQuery(array) {
    return Array(Array.isArray(array) ? array.length : array).fill('?').join(',');
  },
  // 下划线转驼峰
  underlineToCamel(rows) {
    if (!rows) return rows;

    if (Array.isArray(rows)) {
      rows.forEach(r => {
        for (const k in r) {
          const nk = k.replace(/_([a-z])/g, ($0, $1) => $1.toUpperCase());
          if (nk !== k) {
            r[nk] = r[k];
            delete r[k];
          }
        }
      });
    } else {
      for (const k in rows) {
        const nk = k.replace(/_([a-z])/g, ($0, $1) => $1.toUpperCase());
        if (nk !== k) {
          rows[nk] = rows[k];
          delete rows[k];
        }
      }
    }

    return rows;
  },
  datetimeString(rows) {
    if (!rows) return rows;

    if (Array.isArray(rows)) {
      rows.forEach(r => {
        module.exports.datetimeString(r);
      });
    } else {
      for (const k in rows) {
        if (rows[k].constructor === Date) {
          rows[k] = moment(rows[k]).format('YYYY-MM-DD HH:MM:ss');
        }
      }
    }

    return rows;
  },
  // 自动分页器
  async paginator(sql, params) {
    const sqlAst = sqlparser.parse(sql);
    const countAst = sqlparser.parse(sql);

    const page = this.ctx.query.page || 1;
    const limit = this.ctx.query.limit || 20;

    const left = (page - 1) * limit;
    countAst.columns = [{
      as: 'total',
      expr: { type: 'aggr_func', name: 'COUNT', args: { expr: { type: 'star', value: '*' } } },
    }];
    countAst.orderby = null;

    sqlAst.limit = [
      { type: 'number', value: left },
      { type: 'number', value: limit },
    ];

    const totalRow = await this.app.mysql.queryOne(sqlparser.stringify(countAst), params);
    const rows = await this.app.mysql.query(sqlparser.stringify(sqlAst), params);

    return {
      pagination: {
        page,
        limit,
        total: totalRow.total,
      },
      rows: this.ctx.helper.underlineToCamel(rows),
    };
  },
};
