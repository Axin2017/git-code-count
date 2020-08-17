const dayOfWeekMap = {
  0: '星期天',
  1: '星期一',
  2: '星期二',
  3: '星期三',
  4: '星期四',
  5: '星期五',
  6: '星期六'
}

/**
 * 判断日期字符串是不是YYYY-MM-DD格式
 *
 * @param {String} dateStr
 * @return {Boolean}
 */
function isValidateDateStr(dateStr) {
  return /^(\d{4})-\d{1,2}-(\d{1,2})$/.test(dateStr);
}

/**
 * 按照'YYYY-MM-DD HH:mm:ss 星期*' 格式来格式化时间
 *
 * @param {String} timeStr
 * @return {String} 
 */
function formartTime(timeStr) {
  if (!(timeStr instanceof Date)) {
    timeStr = new Date(timeStr);
  }
  return `${timeStr.getFullYear()}-${timeStr.getMonth()}-${timeStr.getDate()} ${timeStr.getHours()}:${timeStr.getMinutes()}:${timeStr.getSeconds()}  ${dayOfWeekMap[timeStr.getDay()]}`;
}

module.exports = {
  isValidateDateStr,
  formartTime
}