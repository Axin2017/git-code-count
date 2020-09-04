#!/usr/bin/env node

const simpleGit = require('simple-git');
const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const process = require('process');

const util = require('./util');

// 用于报错指示当前处于哪个项目
let currentProject = '';
// 代码总数
let total = {
  insertions: 0,
  deletions: 0,
  total: 0
}
function addRecord(insertions, deletions) {
  total = {
    insertions: total.insertions + insertions,
    deletions: total.deletions + deletions,
    total: total.total + insertions - deletions
  }
}

function getConfig() {
  const configFilePath = path.resolve(process.cwd(), './.git-code-count-config.js');
  if (!fs.existsSync(configFilePath)) {
    console.log(`No ${chalk.green('git-code-count-config.js')} file founded,create it first. See ${chalk.magenta('https://github.com/Axin2017/git-code-count')}`);
    throw new Error('No config file founded');
  } else {
    const { availableProject, author } = require(configFilePath);
    if (!availableProject || !Array.isArray(availableProject)) {
      console.log(`Config item ${chalk.bold('availableProject')} is necessary. See ${chalk.magenta('https://github.com/Axin2017/git-code-count')}`);
      throw new Error('Invalid config');
    }
    return { availableProject, author }
  }
}

async function inputParam(availableProject, author) {

  const { fromDay } = await inquirer.prompt([{
    name: 'fromDay',
    message: '输入统计的开始日期，格式为YYYY-MM-DD',
    validate: answer => {
      return util.isValidateDateStr(answer) || '输入日期格式不正确，正确格式如: 2020-01-01';
    }
  }]);

  const { endDay } = await inquirer.prompt([{
    name: 'endDay',
    message: '输入统计的结束日期，格式为YYYY-MM-DD',
    validate: answer => {
      return util.isValidateDateStr(answer) || '输入日期格式不正确，正确格式如: 2020-01-01';
    }
  }]);
  
  let authorKey = author;
  if (!authorKey) {
    const { inputAuthor } = await inquirer.prompt([{
      name: 'inputAuthor',
      message: '输入提交人关键字',
      validate: answer => {
        return (answer && !!answer.trim()) || '输入提交人关键字'
      }
    }]);
    authorKey = inputAuthor;
  }

  const { projectNameList } = await inquirer.prompt({
    name: 'projectNameList',
    message: '选择要统计的项目',
    type: 'checkbox',
    choices: availableProject.map(pr => pr.name),
    validate: checkedList => {
      return checkedList.length > 0 || '请选择至少一个项目';
    }
  })

  return {
    projectNameList,
    authorKey,
    fromDay,
    endDay
  }
}

async function getDescriptionList(git, branchs, index) {
  const branch = branchs[index];
  const description = await git.raw('config', `branch.${branch}.description`);
  // 添加分支注释
  branchs[index] = `${branch} ${description}`;
  if (index < branchs.length - 1) {
    await getDescriptionList(git, branchs, index + 1);
  }
}

async function getBranchList(projectInfoList, index) {
  const projectInfo = projectInfoList[index];
  currentProject = projectInfo.name;
  console.log(projectInfo.path);
  projectInfo.git = simpleGit(projectInfo.path);
  const { name, git } = projectInfo;
  const allBranchList = (await git.branchLocal()).all;
  const { branchList } = await inquirer.prompt({
    name: 'branchList',
    message: `选择${chalk.green(name)}要统计的分支`,
    type: 'checkbox',
    choices: allBranchList,
    validate: checkedList => {
      return checkedList.length > 0 || '请选择至少一个分支';
    }
  });
  // 转换数据结构
  projectInfo.branchs = branchList.map(branch => ({
    name: branch,
    log: [],
    total: {
      insertions: 0,
      deletions: 0,
      total: 0
    }
  }));
  if (index < projectInfoList.length - 1) {
    await getBranchList(projectInfoList, index + 1);
  } else {
    return projectInfoList;
  }
}

async function _getLogList(projectInfo, branchIndex, { timeDuration, authorKey }) {
  currentProject = projectInfo.name;
  const branch = projectInfo.branchs[branchIndex];
  const git = projectInfo.git;
  await git.checkout(branch.name);
  const log = await git.log({
    '--stat': true,
    '--since': `${timeDuration[0]} 00:00:00`,
    '--until': `${timeDuration[1]} 23:59:59`,
    '--author': authorKey,
    '--no-merges': true,
    '--first-parent': true
  });
  branch.log = log.all;
  if (branchIndex < projectInfo.branchs.length - 1) {
    await _getLogList(projectInfo, branchIndex + 1, { timeDuration, authorKey });
  }
}

async function getLogList(projectInfoList, index, { timeDuration, authorKey }) {
  const projectInfo = projectInfoList[index];

  await _getLogList(projectInfo, 0, { timeDuration, authorKey });

  if (index < projectInfoList.length - 1) {
    await getLogList(projectInfoList, index + 1, { timeDuration, authorKey });
  }
}

function printLog(projectInfoList, fromDay, endDay, author) {
  projectInfoList.forEach(projectInfo => {
    currentProject = projectInfo.name;
    console.log('------------------------------------------------------------------------------------------------------------------');
    console.log(`${chalk.green(projectInfo.name)}  统计结果:`);
    projectInfo.branchs.forEach(branch => {
      console.log(`    ${branch.name}`);
      branch.log.forEach(log => {
        const { diff } = log;
        if (diff) {
          const { insertions, deletions, total } = branch.total;
          branch.total = {
            insertions: insertions + diff.insertions,
            deletions: deletions + diff.deletions,
            total: total + diff.insertions - diff.deletions
          };
          addRecord(diff.insertions, diff.deletions);
          console.log(`        ${util.formartTime(log.date)}    ${log.message}    +${diff.insertions}    -${diff.deletions}    =${diff.insertions - diff.deletions}`);
        }
      });
      console.log(`        共计:    +${branch.total.insertions}    -${branch.total.deletions}    =${branch.total.total}`);
      projectInfo.total = {
        insertions: projectInfo.total.insertions + branch.total.insertions,
        deletions: projectInfo.total.deletions + branch.total.deletions,
        total: projectInfo.total.total + branch.total.total
      }
    });
    console.log(`${chalk.green(projectInfo.name)}  共计:    +${projectInfo.total.insertions}    -${projectInfo.total.deletions}    =${projectInfo.total.total}`);
  })

  console.log('==================================================================================================================');
  console.log();
  console.log(chalk.green(`本次统计时间区间: ${fromDay}至${endDay}    作者: ${author}    共计: +${total.insertions} -${total.deletions}  =${total.total}`));
  console.log();
}

async function main() {
  console.log(chalk.red('使用前请确保所有分支都已经提交代码!'));

  // 获取配置
  const { availableProject, author } = getConfig();

  // 获取基本输入参数
  const {
    projectNameList,
    authorKey,
    fromDay,
    endDay
  } = await inputParam(availableProject, author);

  // 转换一下数据结构
  const projectInfoList = projectNameList.map(name => {
    const pro = availableProject.find(p => p.name === name);
    return {
      name,
      // 转换成绝对路径，方便后续操作
      path: path.resolve(process.cwd(), pro.path),
      branchs: [],
      git: null,
      total: {
        insertions: 0,
        deletions: 0,
        total: 0
      }
    };
  });

  // 根据项目选取要统计的分支
  await getBranchList(projectInfoList, 0);

  // 获取日志
  await getLogList(projectInfoList, 0, {
    timeDuration: [fromDay, endDay],
    authorKey
  });

  printLog(projectInfoList, fromDay, endDay, authorKey);
}

main();
