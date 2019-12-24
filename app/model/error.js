/** *
 *
 * @author steephenliu
 * @date 2019-03-11
**/

'use strict';

module.exports = class BizError extends Error {
  constructor(errMsg, status, code, data) {
    super(errMsg);
    this.code = code || status;
    this.status = status;
    this.data = data;
  }
};
