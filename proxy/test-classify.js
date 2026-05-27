const assert = require('assert');
const { classifyPlayers } = require('./classify');

function testBots() {
    const players = [
        { id: 1, name: 'Alice', userid: '123' },
        { id: 2, name: 'Bot1', userid: '0' },
        { id: 3, name: 'Bot2', userid: '0' }
    ];
    const plays = [
        { id: 1, playerScores: [{ playerRefId: 1 }, { playerRefId: 2 }] },
        { id: 2, playerScores: [{ playerRefId: 1 }, { playerRefId: 3 }] }
    ];
    const result = classifyPlayers(players, plays);

    const bot1 = result.find(p => p.id === 2);
    const bot2 = result.find(p => p.id === 3);
    const alice = result.find(p => p.id === 1);

    assert.strictEqual(bot1.isBot, true, 'Bot1 should be a bot');
    assert.strictEqual(bot1.isMain, false, 'Bot1 should not be main');
    assert.strictEqual(bot1.isOther, false, 'Bot1 should not be other');

    assert.strictEqual(bot2.isBot, true, 'Bot2 should be a bot');
    assert.strictEqual(bot2.isMain, false, 'Bot2 should not be main');
    assert.strictEqual(bot2.isOther, false, 'Bot2 should not be other');

    assert.strictEqual(alice.isBot, false, 'Alice should not be a bot');
    console.log('✔ testBots passed');
}

function testMainPlayers() {
    const players = [
        { id: 1, name: 'Alice', userid: '123' },
        { id: 2, name: 'Bob', userid: '456' }
    ];
    const plays = [
        { id: 1, playerScores: [{ playerRefId: 1 }, { playerRefId: 2 }] },
        { id: 2, playerScores: [{ playerRefId: 1 }, { playerRefId: 2 }] },
        { id: 3, playerScores: [{ playerRefId: 1 }, { playerRefId: 2 }] }
    ];
    const result = classifyPlayers(players, plays);

    const alice = result.find(p => p.id === 1);
    const bob = result.find(p => p.id === 2);

    assert.strictEqual(alice.isBot, false, 'Alice should not be a bot');
    assert.strictEqual(alice.isMain, true, 'Alice should be main');
    assert.strictEqual(alice.isOther, false, 'Alice should not be other');

    assert.strictEqual(bob.isBot, false, 'Bob should not be a bot');
    assert.strictEqual(bob.isMain, true, 'Bob should be main');
    assert.strictEqual(bob.isOther, false, 'Bob should not be other');

    console.log('✔ testMainPlayers passed');
}

function testOtherPlayers() {
    const players = [
        { id: 1, name: 'Alice', userid: '123' },
        { id: 2, name: 'Charlie', userid: '789' },
        { id: 3, name: 'Dave', userid: '999' }
    ];
    const plays = [
        { id: 1, playerScores: [{ playerRefId: 1 }, { playerRefId: 2 }] },
        { id: 2, playerScores: [{ playerRefId: 1 }] },
        { id: 3, playerScores: [{ playerRefId: 1 }] }
    ];
    const result = classifyPlayers(players, plays);

    const alice = result.find(p => p.id === 1);
    const charlie = result.find(p => p.id === 2);
    const dave = result.find(p => p.id === 3);

    assert.strictEqual(alice.isBot, false, 'Alice should not be a bot');
    assert.strictEqual(alice.isMain, true, 'Alice should be main (3+ plays)');
    assert.strictEqual(alice.isOther, false, 'Alice should not be other');

    assert.strictEqual(charlie.isBot, false, 'Charlie should not be a bot');
    assert.strictEqual(charlie.isMain, false, 'Charlie should not be main (only 1 play)');
    assert.strictEqual(charlie.isOther, true, 'Charlie should be other');

    assert.strictEqual(dave.isBot, false, 'Dave should not be a bot');
    assert.strictEqual(dave.isMain, false, 'Dave should not be main (0 plays)');
    assert.strictEqual(dave.isOther, true, 'Dave should be other');

    console.log('✔ testOtherPlayers passed');
}

function testThresholdExactlyThree() {
    const players = [
        { id: 1, name: 'Alice', userid: '123' },
        { id: 2, name: 'Eve', userid: '321' }
    ];
    const plays = [
        { id: 1, playerScores: [{ playerRefId: 1 }] },
        { id: 2, playerScores: [{ playerRefId: 1 }, { playerRefId: 2 }] },
        { id: 3, playerScores: [{ playerRefId: 1 }, { playerRefId: 2 }] }
    ];
    const result = classifyPlayers(players, plays);

    const alice = result.find(p => p.id === 1);
    const eve = result.find(p => p.id === 2);

    assert.strictEqual(alice.isMain, true, 'Alice with 3 plays should be main');
    assert.strictEqual(eve.isMain, false, 'Eve with 2 plays should not be main');
    assert.strictEqual(eve.isOther, true, 'Eve with 2 plays should be other');

    console.log('✔ testThresholdExactlyThree passed');
}

function runTests() {
    console.log('Running classify tests...\n');
    testBots();
    testMainPlayers();
    testOtherPlayers();
    testThresholdExactlyThree();
    console.log('\n✅ All tests passed!');
}

runTests();
