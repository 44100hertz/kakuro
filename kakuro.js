'use strict';

let canvas = document.getElementById('game_board');
let ctx = canvas.getContext('2d');

const array2d = (width, height, fn) =>
      Array(width).fill().map(
          (_, y) => Array(height).fill().map(
              (_, x) => fn(x, y)));

const for_2d = (board, fn) =>
      board.forEach((row, y) => row.forEach((_, x) => fn(x, y)));

const draw_board = (board) => for_2d(board, (x, y) => {
    const width = canvas.width / board[0].length;
    const height = canvas.height / board.length;
    const xpos = width * x, ypos = height * y;
    const cell = board[y][x];
    switch (cell.kind) {
    case 'num':
        ctx.fillStyle = 'rgb(0, 0, 0)';
        ctx.font = '48px sans';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.strokeStyle = 'rgb(200, 200, 200)';
        ctx.strokeRect(xpos, ypos, width, height);

        // HACK: manual metrics
        ctx.fillText(cell.value, xpos+width/2, ypos+height*0.55, width);
        break;
    case 'hint':
        ctx.lineWidth = 2.0;
        ctx.fillStyle = 'rgb(0, 0, 0)';
        ctx.fillRect(xpos, ypos, width, height);

        ctx.strokeStyle = 'rgb(200, 200, 200)';
        ctx.strokeRect(xpos, ypos, width, height);

        ctx.beginPath();
        ctx.moveTo(xpos, ypos);
        ctx.lineTo(xpos+width, ypos+width);
        ctx.closePath();
        ctx.stroke();

        ctx.font = '24px sans';
        ctx.fillStyle = 'rgb(255, 255, 255)';
        ctx.textAlign = 'center';
        // HACK: manual metrics
        if (cell.hintl) {
            ctx.textBaseline = 'hanging';
            ctx.fillText(cell.hintl, xpos + width*1/4, ypos + height*0.6, width);
        }
        if (cell.hintr) {
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(cell.hintr, xpos + width*3/4, ypos + height*0.4, width);
        }
        break;
    default: break;
    }
});

const calc_hints = (board) => for_2d(board, (x, y) => {
    if (board[y][x].kind != 'hint')
        return;

    const cell_num = (x, y) => board[y] && board[y][x] && board[y][x].value;

    const search_and_total = (x, y, xoff, yoff) => {
        const num = cell_num(x+xoff, y+yoff);
        return num ? num + search_and_total(x+xoff, y+yoff, xoff, yoff) : 0;
    };

    board[y][x].hintl = search_and_total(x, y, 0, 1);
    board[y][x].hintr = search_and_total(x, y, 1, 0);
});

const border_board = (w, h) => {
    let board = array2d(w, h, (x, y) => {
        if (x == 0 || x == w-1 || y == 0 || y == h-1) {
            return {kind: 'hint'};
        } else {
            const value = Math.floor(Math.random() * 9.0 + 1.0);
            return {kind: 'num', value};
        }
    });
    calc_hints(board);
    return board;
};

const board = border_board(8, 8);
draw_board(board);
