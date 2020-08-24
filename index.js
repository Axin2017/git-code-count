#!/usr/bin/env node

const simpleGit = require('simple-git');
const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');

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

async function inputParam() {
  const { workSpace } = await inquirer.prompt([{
    name: 'workSpace',
    message: '输入你的工作目录',
    validate: answer => {
      try {
        if (!answer || !fs.statSync(answer.trim()).isDirectory) {
          return '输入的路径不是合法的目录';
        }
        return true;
      } catch {
        return '输入的路径不是合法的目录';
      }
    }
  }]);

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

  const { authorKey } = await inquirer.prompt([{
    name: 'authorKey',
    message: '输入提交人关键字',
    validate: answer => {
      return (answer && !!answer.trim()) || '输入提交人关键字'
    }
  }]);

  const dirList = fs.readdirSync(workSpace);
  const gitProjectList = dirList.filter(dir => {
    const prjPath = path.join(workSpace, dir);
    return fs.statSync(prjPath).isDirectory() && fs.readdirSync(prjPath).find(subDir => subDir === '.git')
  });
  const { projectList } = await inquirer.prompt({
    name: 'projectList',
    message: '选择要统计的项目',
    type: 'checkbox',
    choices: gitProjectList,
    validate: checkedList => {
      return checkedList.length > 0 || '请选择至少一个项目';
    }
  })

  return {
    workSpace,
    authorKey,
    projectList,
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

async function getBranchList(workSpace, projectInfoList, index) {
  const projectInfo = projectInfoList[index];
  currentProject = projectInfo;
  projectInfo.git = simpleGit(path.join(workSpace, projectInfo.name));
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
    await getBranchList(workSpace, projectInfoList, index + 1);
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
    '--author': authorKey
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

function printLog(projectInfoList, fromDay, endDay) {
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
  console.log(chalk.green(`本次统计时间区间: ${fromDay}至${endDay}    共计:  +${total.insertions}    -${total.deletions}    =${total.total}`));
  console.log();
}

async function main() {
  // 获取基本输入参数
  const {
    workSpace,
    authorKey,
    projectList,
    fromDay,
    endDay
  } = await inputParam();

  // 转换一下数据结构
  const projectInfoList = projectList.map(project => ({
    name: project,
    branchs: [],
    git: null,
    total: {
      insertions: 0,
      deletions: 0,
      total: 0
    }
  }));

  // 根据项目选取要统计的分支
  await getBranchList(workSpace, projectInfoList, 0);

  // 获取日志
  await getLogList(projectInfoList, 0, {
    timeDuration: [fromDay, endDay],
    authorKey
  });

  printLog(projectInfoList, fromDay, endDay);
}

main();
