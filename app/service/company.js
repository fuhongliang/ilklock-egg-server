/** *
 *
 * @author steephenliu
 * @date 2019-03-08
**/

'use strict';

const BizError = require('../model/error');
const assert = require('assert');
const Service = require('egg').Service;

class CompanyService extends Service {
  async findById(id) {
    const { tables } = this.config;
    const company = await this.app.mysql.queryOne(`select * from ${tables.company} where is_deleted = 0 and id = ?`, [ id ]);

    if (!company) throw new BizError('公司不存在');

    return this.ctx.helper.underlineToCamel(company);
  }

  async findAll() {
    const { tables } = this.config;
    const companys = await this.app.mysql.query(`select * from ${tables.company} where is_deleted = 0`);
    this.ctx.helper.underlineToCamel(companys);
    return companys;
  }

  async findByUser(userId) {
    const { tables } = this.config;

    const companys = await this.app.mysql.query(`select c.* from ${tables.userCompany} uc left join ${tables.company} c on uc.company = c.id where uc.user = ? and c.is_deleted = 0;`, [ userId ]);

    return companys;
  }

  async updateById(company) {
    const { tables } = this.config;

    assert(company.name, new BizError('请输入公司名称'));
    company.update_at = new Date();

    let results;
    if (company.id) {
      results = await this.app.mysql.query(
        `update ${tables.company} set name = ?, description = ?, update_at = ? where id = ? and is_deleted = 0`,
        [ company.name, company.description, company.update_at, company.id ]
      );
    } else {
      company = {
        id: null,
        is_deleted: 0,
        name: company.name,
        description: company.description,
        create_at: new Date(),
        update_at: new Date(),
      };

      results = await this.app.mysql.query(`insert into ${tables.company} set ?`, [ company ]);
    }

    if (results.affectedRows <= 0) throw new BizError('更新失败');

    return true;
  }
}

module.exports = CompanyService;
