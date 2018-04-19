'use strict';

let canvas = document.getElementById('game_board');
let ctx = canvas.getContext('2d');

const random_int = (bound) => Math.floor(Math.random() * bound);

const array2d = (width, height, fn) =>
      Array(width).fill().map(
          (_, y) => Array(height).fill().map(
              (_, x) => fn(x, y)));

const for_2d = (board, fn) =>
      board.forEach((row, y) => row.forEach((cell, x) => fn(x, y, cell)));

const draw_board = (board) => for_2d(board, (x, y, cell) => {
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
    // group numbers together
    for_2d(board, (x, y, cell) => {
        if (cell.type != 'hint') return;
        const group_cells = (xoff, yoff, seen_index) => {
            const seen = [];
            for_num_group(board, x, y, xoff, yoff, (x, y, cell) => {
                cell[seen_index] = seen;
            });
        };
        group_cells(1, 0, "seenh");
        group_cells(0, 1, "seenv");
    });

    // calculate number for each cell
    for_2d(board, (x, y, cell) => {
        if (cell.type != 'num') return;
        let value = random_int(9) + 1;
        const orig_value = value;
        while (cell.seenh[value] || cell.seenv[value]) {
            value = (value % 9) + 1; // increment and wrap from 9->1
            if (value == orig_value) {
                throw Error('number collision');
            }
        }
        cell.seenh[value] = true;
        cell.seenv[value] = true;
        cell.value = value;
    });

    // total hints
    for_2d(board, (x, y, cell) => {
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
        for_2d(board, (x, y, cell) => {
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
    for_2d(board, (x, y, cell) => {
        if (cell.type == 'num') {
            [cx, cy] = [x, y];
            cell.seen = false;
            ++cell_count;
        }
    });
    // pass 2: flood fill from the number, and count
    let seen_count = 0;
    const flood_fill = (x, y) => {
        const fill_neighbor = (x, y) => {
            const cell = board[y] && board[y][x];
            if (cell && cell.type == 'num' && !cell.seen) {
                cell.seen = true;
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
    // black out a constant number of spaces
    for (let i=0; i<(gap_chance * w * h); ++i) {
        const [x, y] = [random_int(w)+1, random_int(w)+1];
        const cell = board[y][x];
        if (cell.type == 'hint') --i; // try again until enough filled
        cell.type = 'hint';
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
            board = random_board(w, h, 0.5);
            fix_board(board);
            calc_nums(board);
        } catch (err) {
            console.log(err.message);
            bad_board = true;
        }
    } while (bad_board);
    return board;
};
const board = make_board(10, 10);
draw_board(board);
