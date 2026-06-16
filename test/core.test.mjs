import test from 'node:test';
import assert from 'node:assert'; // нестрогий: объекты из vm-контекста имеют чужой прототип, deepStrictEqual бы их не сравнил
import { loadCore, mulberry32 } from './helpers.mjs';

test('LotoCore загружается из index.html', () => {
  const core = loadCore();
  assert.equal(typeof core, 'object');
});

test('TENS — 10 непересекающихся десятков, покрывают 1..99', () => {
  const core = loadCore();
  assert.equal(core.TENS.length, 10);
  assert.deepEqual(core.TENS[0], [1, 10]);
  assert.deepEqual(core.TENS[9], [91, 99]);
});

test('pickBadgeNumbers: 5 чисел из 5 разных десятков, 1..99, по возрастанию', () => {
  const core = loadCore();
  const rng = mulberry32(42);
  for (let iter = 0; iter < 500; iter++) {
    const nums = core.pickBadgeNumbers(rng);
    assert.equal(nums.length, 5);
    for (let i = 1; i < 5; i++) assert.ok(nums[i] > nums[i - 1]);
    nums.forEach((n) => assert.ok(n >= 1 && n <= 99));
    const tens = new Set(nums.map((n) => core.TENS.findIndex((r) => n >= r[0] && n <= r[1])));
    assert.equal(tens.size, 5);
  }
});

test('comboKey канонический (не зависит от порядка)', () => {
  const core = loadCore();
  assert.equal(core.comboKey([5, 1, 3, 2, 4]), core.comboKey([1, 2, 3, 4, 5]));
});

test('isValidCombo: принимает корректные, отклоняет неверные', () => {
  const core = loadCore();
  assert.equal(core.isValidCombo([3, 14, 25, 47, 91]), true);   // 5 разных десятков
  assert.equal(core.isValidCombo([3, 7, 25, 47, 91]), false);   // 3 и 7 из одного десятка
  assert.equal(core.isValidCombo([3, 14, 25, 47]), false);      // не 5 чисел
  assert.equal(core.isValidCombo([0, 14, 25, 47, 91]), false);  // вне диапазона
  assert.equal(core.isValidCombo([3, 3, 25, 47, 91]), false);   // повтор
  assert.equal(core.isValidCombo(null), false);
});

test('assignNumbers: сохраняет валидные, генерирует недостающие, всё уникально, сохраняет компанию/должность', () => {
  const core = loadCore();
  const rng = mulberry32(7);
  const input = [
    { name: 'Иван', surname: 'Иванов', company: 'ООО Ромашка', position: 'Менеджер', numbers: [3, 14, 25, 47, 91] }, // валидно
    { name: 'Анна', surname: 'Петрова', company: 'ИП Петрова', position: 'Директор', numbers: null },               // сгенерировать
    { name: 'Пётр', surname: 'Сидоров', company: '', position: '', numbers: [3, 7, 25, 47, 91] }                    // невалидно -> сгенерировать
  ];
  const out = core.assignNumbers(input, rng);
  assert.equal(out.length, 3);
  assert.deepEqual(out[0].numbers, [3, 14, 25, 47, 91]); // сохранён
  out.forEach((p) => assert.equal(core.isValidCombo(p.numbers), true));
  const keys = new Set(out.map((p) => core.comboKey(p.numbers)));
  assert.equal(keys.size, 3); // все комбинации уникальны
  assert.equal(out[1].name, 'Анна'); // имена/фамилии сохранены
  assert.equal(out[0].company, 'ООО Ромашка'); // компания сохранена
  assert.equal(out[1].position, 'Директор');   // должность сохранена
});

test('assignNumbers: уникальность на большом списке', () => {
  const core = loadCore();
  const rng = mulberry32(123);
  const input = Array.from({ length: 200 }, (_, i) => ({ name: 'N' + i, surname: 'S' + i, numbers: null }));
  const out = core.assignNumbers(input, rng);
  const keys = new Set(out.map((p) => core.comboKey(p.numbers)));
  assert.equal(keys.size, 200);
});

test('delimiterOf определяет разделитель', () => {
  const core = loadCore();
  assert.equal(core.delimiterOf('Иван,Иванов'), ',');
  assert.equal(core.delimiterOf('Иван;Иванов'), ';');
  assert.equal(core.delimiterOf('Иван\tИванов'), '\t');
  assert.equal(core.delimiterOf('ИванИванов'), ','); // запятая по умолчанию
});

test('parseList: 2 колонки -> компания/должность пустые, numbers null', () => {
  const core = loadCore();
  const res = core.parseList('Иван,Иванов');
  assert.deepEqual(res.participants[0], { name: 'Иван', surname: 'Иванов', company: '', position: '', numbers: null });
});

test('parseList: 4 колонки (Имя,Фамилия,Компания,Должность) -> numbers null, заголовок и пустые строки', () => {
  const core = loadCore();
  const text = 'Имя,Фамилия,Компания,Должность\nИван,Иванов,ООО Ромашка,Менеджер\n\nАнна,Петрова,ИП Петрова,Директор\n';
  const res = core.parseList(text);
  assert.equal(res.participants.length, 2);
  assert.deepEqual(res.participants[0], { name: 'Иван', surname: 'Иванов', company: 'ООО Ромашка', position: 'Менеджер', numbers: null });
  assert.equal(res.participants[1].name, 'Анна');
});

test('parseList: 9 колонок -> компания, должность и numbers заполнены', () => {
  const core = loadCore();
  const text = 'Пётр,Сидоров,ООО Заря,Инженер,3,14,25,47,91';
  const res = core.parseList(text);
  assert.equal(res.participants.length, 1);
  assert.equal(res.participants[0].company, 'ООО Заря');
  assert.equal(res.participants[0].position, 'Инженер');
  assert.deepEqual(res.participants[0].numbers, [3, 14, 25, 47, 91]);
});

test('parseList: смешанный список и разделитель ;', () => {
  const core = loadCore();
  const text = 'Иван;Иванов;ООО А;Менеджер\nПётр;Сидоров;ООО Б;Инженер;3;14;25;47;91';
  const res = core.parseList(text);
  assert.equal(res.participants[0].numbers, null);
  assert.deepEqual(res.participants[1].numbers, [3, 14, 25, 47, 91]);
});

test('parseList: поле в кавычках с запятой внутри', () => {
  const core = loadCore();
  const text = 'Иван,Иванов,"ООО Рога, Копыта","Менеджер, опт",3,14,25,47,91';
  const res = core.parseList(text);
  assert.equal(res.participants.length, 1);
  assert.equal(res.participants[0].company, 'ООО Рога, Копыта');
  assert.equal(res.participants[0].position, 'Менеджер, опт');
  assert.deepEqual(res.participants[0].numbers, [3, 14, 25, 47, 91]);
});

const ZERO = () => 0; // rng()->0 всегда тянет remaining[0]: бочонки выпадают 1,2,3,...

test('createBag: числа 1..99', () => {
  const core = loadCore();
  const bag = core.createBag();
  assert.equal(bag.length, 99);
  assert.equal(bag[0], 1);
  assert.equal(bag[98], 99);
});

test('игра: один победитель при закрытии всех 5 чисел', () => {
  const core = loadCore();
  const game = core.createGame([{ name: 'A', surname: 'A', numbers: [1, 2, 3, 4, 5] }], 1);
  let res;
  for (let i = 0; i < 5; i++) res = game.draw(ZERO); // выпадут 1,2,3,4,5
  assert.equal(res.number, 5);
  assert.equal(game.finished, true);
  assert.equal(game.winners.length, 1);
  assert.equal(game.winners[0].name, 'A');
});

test('игра: ничья — несколько закрылись на одном бочонке (показываем всех)', () => {
  const core = loadCore();
  const game = core.createGame([
    { name: 'A', surname: 'A', numbers: [1, 2, 3, 4, 5] },
    { name: 'B', surname: 'B', numbers: [1, 2, 3, 4, 5] }
  ], 1);
  for (let i = 0; i < 5; i++) game.draw(ZERO);
  assert.equal(game.finished, true);
  assert.equal(game.winners.length, 2); // порог 1, но оба закрылись одновременно
});

test('игра: draw возвращает null после завершения', () => {
  const core = loadCore();
  const game = core.createGame([{ name: 'A', surname: 'A', numbers: [1, 2, 3, 4, 5] }], 1);
  for (let i = 0; i < 5; i++) game.draw(ZERO);
  assert.equal(game.draw(ZERO), null);
});

test('игра: завершается при опустошении мешочка, даже если победителей меньше нужного', () => {
  const core = loadCore();
  const game = core.createGame([{ name: 'A', surname: 'A', numbers: [1, 2, 3, 4, 99] }], 5);
  let res;
  for (let i = 0; i < 99; i++) res = game.draw(ZERO); // вытащим все
  assert.equal(res.finished, true);
  assert.equal(game.remainingCount, 0);
  assert.equal(game.winners.length, 1); // один закрылся, но порог 5 не достигнут
});

test('игра: progress считает закрытые числа', () => {
  const core = loadCore();
  const game = core.createGame([{ name: 'A', surname: 'A', numbers: [1, 2, 3, 4, 5] }], 1);
  game.draw(ZERO); game.draw(ZERO); game.draw(ZERO); // 1,2,3
  const pr = game.progress();
  assert.equal(pr[0].closed, 3);
  assert.equal(pr[0].total, 5);
});
