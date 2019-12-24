/** *
 *
 * @author steephenliu
 * @date 2019-03-08
**/

'use strict';

const assert = require('assert');
const Service = require('egg').Service;
const BizError = require('../model/error');


class CompanyAreaService extends Service {
  async findById(id) {
    const { tables } = this.config;
    const company = this.ctx.session.company;

    const area = await this.app.mysql.queryOne(`select id,name,code,parent,level,company,\`order\` from ${tables.companyArea} where id = ? and company = ? and is_deleted = 0`, [ id, company ]);
    return area;
  }

  async findByCompany() {
    const tree = await this.buildAreaTree();

    const list = [];
    const stack = [ ...tree ].sort((a, b) => a.order - b.order).reverse();
    while (stack.length > 0) {
      const e = stack.pop();

      const x = { ...e };
      delete x.children;
      list.push(x);
      if (e.children && e.children.length > 0) {
        [ ...e.children ].sort((a, b) => a.order - b.order).reverse().forEach(i => stack.push(i));
      }
    }

    return list;
  }

  async findToplevelByCompany() {
    const { tables } = this.config;
    const company = this.ctx.session.company;

    const areas = await this.app.mysql.query(`select id,name,code,parent,level,company,,\`order\` from ${tables.companyArea} where company = ? and level = 1 and is_deleted = 0`, [ company ]);
    areas.sort((a, b) => (a.level === b.level ? a.order - b.order : a.level - b.level));
    return areas;
  }

  async buildAreaTree(toplevelLimit) {
    const { tables } = this.config;
    const company = this.ctx.session.company;

    const areas = await this.app.mysql.query(`select id,name,code,parent,level,company,\`order\` from ${tables.companyArea} where company = ? and is_deleted = 0 order by level asc`, [ company ]);

    const toplevel = [];
    const idMap = {};
    for (let i = 0; i < areas.length; i++) {
      const row = areas[i];
      row.children = [];

      idMap[row.id] = row;

      if (row.level === 1) {
        row.parent = 0;
        toplevel.push(row);
      } else {
        const parentId = row.parent;
        if (!idMap[parentId]) continue;

        idMap[parentId].children.push(row);
      }
    }

    // 限制顶层区域
    if (toplevelLimit) {
      for (let i = 0; i < toplevel.length; i++) {
        if (toplevel[i].id === toplevelLimit) {
          return toplevel[i].children;
        }
      }

      return [];
    }
    return toplevel;
  }

  async updateById(area) {
    const { tables } = this.config;
    const company = this.ctx.session.company;

    assert(area.name || area.code, new BizError('请输入区域名称或编号'));
    assert(area.level >= 1, new BizError('`level` must be a number.'));

    if (area.level === 1) area.parent = 0;
    else assert(area.parent >= 1, '`parent` must be a number.');

    let results;

    area.update_at = new Date();
    area.code = area.code || '';
    if (area.id) {
      results = await this.app.mysql.query(
        `update ${tables.companyArea} set name = ?, code = ?, parent = ?, level = ?, \`order\` = ?, update_at = ? where id = ? and company = ? and is_deleted = 0`,
        [ area.name, area.code, area.parent, area.level, area.order, area.update_at, area.id, company ]);
    } else {
      results = await this.app.mysql.query(`insert into ${tables.companyArea} set ?`, [{
        name: area.name,
        code: area.code,
        order: area.order,
        level: area.level,
        parent: area.parent,
        update_at: new Date(),
        create_at: new Date(),
        is_deleted: 0,
        company,
      }]);
    }

    if (area.childOrder) {
      this.updateOrder(area.childOrder);
    }

    assert(results.affectedRows > 0, new BizError('更新错误'));

    return {
      id: area.id || results.insertId,
    };
  }

  async updateOrder(orders) {
    const { tables } = this.config;
    const company = this.ctx.session.company;

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      await this.app.mysql.query(
        `update ${tables.companyArea} set \`order\` = ? where id = ? and company = ? and is_deleted = 0`,
        [ order.order, order.id, company ]
      );
    }

    return true;
  }

  async delete(id) {
    const { tables } = this.config;
    const company = this.ctx.session.company;

    const results = await this.app.mysql.query(`update ${tables.companyArea} set is_deleted = 1 where id = ? and company = ?`, [
      id,
      company,
    ]);

    assert(results.affectedRows > 0, new BizError('更新错误'));

    return { id };
  }
}

module.exports = CompanyAreaService;
