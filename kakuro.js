'use strict';

let canvas = document.getElementById('game_board');
let ctx = canvas.getContext('2d');

const random_int = (bound) =>
          Math.floor(Math.random() * bound);

const array2d = (width, height, fn) =>
          Array(width).fill().map(
              (_, y) => Array(height).fill().map(
                  (_, x) => fn(x, y)));

const array2d_of_size = (arr, fn) =>
          array2d(arr[0].length, arr.length, fn);

const for2d = (board, fn) =>
          board.forEach((row, y) => row.forEach((cell, x) => fn(x, y, cell)));

const for_num_group = (board, x, y, xoff, yoff, fn, len=0) => {
    x += xoff;
    y += yoff;
    const cell = board[y] && board[y][x];
    if (cell && cell.type == "num") {
        fn(x, y, cell);
        return for_num_group(board, x, y, xoff, yoff, fn, ++len);
    }
    return [len, x, y];
};

const calc_nums = (board) => {
    const seenrow = array2d_of_size(board, () => false);
    const seencol = array2d_of_size(board, () => false);
    // group numbers together
    for2d(board, (x, y, cell) => {
        if (cell.type != 'hint') return;
        const group_cells = (xoff, yoff, arr) => {
            const seen = [];
            for_num_group(board, x, y, xoff, yoff, (x, y, cell) => {
                arr[y][x] = seen;
            });
        };
        group_cells(1, 0, seenrow);
        group_cells(0, 1, seencol);
    });

    // calculate number for each cell
    for2d(board, (x, y, cell) => {
        if (cell.type != 'num') return;
        let value = random_int(9) + 1;
        const orig_value = value;
        const [row, col] = [seenrow[y][x], seencol[y][x]];
        while (row[value] || col[value]) {
            value = (value % 9) + 1; // increment and wrap from 9->1
            if (value == orig_value) {
                throw Error('number collision');
            }
        }
        row[value] = col[value] = true;
        cell.value = value;
    });

    // total hints
    for2d(board, (x, y, cell) => {
        if (cell.type != 'hint') return;
        const total_cells = (xoff, yoff) => {
            let total = 0;
            for_num_group(board, x, y, xoff, yoff, (x, y, cell) => {
                total += cell.value;
            });
            return total;
        };
        cell.hintv = total_cells(0, 1);
        cell.hinth = total_cells(1, 0);
    });
};

const fix_board = (board) => {
    let fix_again;
    const fix_dir = (xoff, yoff) => {
        for2d(board, (x, y, cell) => {
            if (cell.type != "hint") return;
            const [len, ex, ey] = for_num_group(board, x, y, xoff, yoff, () => {});
            const endcell = board[ey] && board[ey][ex];
            if (len == 1) {
                // clear out neighbors
                fix_again = true;
                if (!endcell || endcell.border ||
                    (Math.random() < 0.5 && !cell.border))
                {
                    cell.type = 'num';
                } else {
                    endcell.type = 'num';
                }
            } else if (len > 9) {
                // fill in row
                fix_again = true;
                for_num_group(board, x, y, xoff, yoff, (x, y, cell) => {
                    if (Math.random() < 0.5)
                        cell.type = 'hint';
                });
            }
        });
    };
    do {
        fix_again = false;
        fix_dir(0, 1);
        fix_dir(1, 0);
    } while (fix_again)

    // continuity check
    // pass 1: count cells, mark not seen, find some number
    let cx, cy;
    let cell_count = 0;
    const seen = array2d_of_size(board, () => false);
    for2d(board, (x, y, cell) => {
        if (cell.type == 'num') {
            [cx, cy] = [x, y];
            ++cell_count;
        }
    });
    // pass 2: flood fill from the number, and count
    let seen_count = 0;
    const flood_fill = (x, y) => {
        const fill_neighbor = (x, y) => {
            const cell = board[y] && board[y][x];
            if (cell && cell.type == 'num' && !seen[y][x]) {
                seen[y][x] = true;
                ++seen_count;
                flood_fill(x, y);
            }
        };
        fill_neighbor(x-1, y);
        fill_neighbor(x+1, y);
        fill_neighbor(x, y-1);
        fill_neighbor(x, y+1);
    };
    flood_fill(cx, cy);
    if (cell_count > seen_count) {
        throw Error("non-continuous board");
    }
};

const random_board = (w, h, gap_chance) => {
    const board = array2d(w+2, h+2, (x, y) => {
        if (x == 0 || x == w+1 || y == 0 || y == h+1) {
            return {type: 'hint', border: true};
        } else {
            return {type: 'num'};
        }
    });

    const is_hint = (x, y) =>
          board[y] && board[y][x] && board[y][x].type == 'hint';

    const is_valid = (x, y) =>
          [[1,0], [0,1], [0,-1], [-1,0]]
          .every(([xoff, yoff]) =>
                 is_hint(x+xoff, y+yoff) || !is_hint(x+xoff*2, y+yoff*2));

    for (let i=0; i<(gap_chance * w * h);) {
        const [x, y] = [random_int(w)+1, random_int(w)+1];
        const cell = board[y][x];
        if (!is_hint(x, y) && is_valid(x, y)) {
//        if (!is_hint(x, y)) {
            cell.type = 'hint';
            ++i;
        }
    }
    return board;
};

// make a board persistantly!
const make_board = (w, h) => {
    let board;
    let bad_board;
    do {
        bad_board = false;
        try {
            board = random_board(w, h, 0.2);
            fix_board(board);
            calc_nums(board);
        } catch (err) {
            console.log(err.message);
            bad_board = true;
        }
    } while (bad_board);
    return board;
};

const draw_board = (board) => for2d(board, (x, y, cell) => {
    const width = canvas.width / board[0].length;
    const height = canvas.height / board.length;
    const xpos = width * x, ypos = height * y;
    const font_size = height * 0.6;
    switch (cell.type) {
    case 'num':
        ctx.fillStyle = 'rgb(0, 0, 0)';
        ctx.font = `${font_size}px sans`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.strokeStyle = 'rgb(200, 200, 200)';
        ctx.strokeRect(xpos, ypos, width, height);

        // HACK: manual metrics
        break;
        ctx.fillText(cell.value, xpos+width/2, ypos+height*0.55, width);
        break;
    case 'hint':
        ctx.lineWidth = 2.0;
        ctx.fillStyle = 'rgb(0, 0, 0)';
        ctx.fillRect(xpos, ypos, width, height);

        ctx.strokeStyle = 'rgb(200, 200, 200)';
        ctx.strokeRect(xpos, ypos, width, height);

        if (!cell.hintv && !cell.hinth)
            break;

        ctx.beginPath();
        ctx.moveTo(xpos, ypos);
        ctx.lineTo(xpos+width, ypos+width);
        ctx.closePath();
        ctx.stroke();

        ctx.font = `${font_size*0.5}px sans`;
        ctx.fillStyle = 'rgb(255, 255, 255)';
        ctx.textAlign = 'center';
        // HACK: manual metrics
        if (cell.hintv) {
            ctx.textBaseline = 'hanging';
            ctx.fillText(cell.hintv, xpos + width*1/4, ypos + height*0.6, width);
        }
        if (cell.hinth) {
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(cell.hinth, xpos + width*3/4, ypos + height*0.4, width);
        }
        break;
    default: break;
    }
});

const board = make_board(30, 30);
draw_board(board);
