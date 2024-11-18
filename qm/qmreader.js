"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parse = exports.LocationType = exports.ParameterChangeType = exports.ParameterShowingType = exports.ParamCritType = exports.ParamType = exports.HEADER_QMM_7_WITH_OLD_TGE_BEHAVIOUR = exports.HEADER_QMM_7 = exports.HEADER_QMM_6 = exports.HEADER_QM_4 = exports.HEADER_QM_3 = exports.HEADER_QM_2 = exports.PlayerCareer = exports.WhenDone = exports.Reader = exports.LOCATION_TEXTS = void 0;
exports.LOCATION_TEXTS = 10;
/** Exported only for tests */
class Reader {
    constructor(data) {
        this.data = data;
        this.i = 0;
    }
    int32() {
        const result = this.data.readInt32LE(this.i);
        /*
            this.data[this.i] +
                          this.data[this.i + 1] * 0x100 +
                        this.data[this.i + 2] * 0x10000 +
                        this.data[this.i + 3] * 0x1000000;
                        */
        this.i += 4;
        return result;
    }
    readString(canBeUndefined = false) {
        const ifString = this.int32();
        if (ifString) {
            const strLen = this.int32();
            const str = this.data.slice(this.i, this.i + strLen * 2).toString("utf16le");
            this.i += strLen * 2;
            return str;
        }
        else {
            return canBeUndefined ? undefined : "";
        }
    }
    byte() {
        return this.data[this.i++];
    }
    dwordFlag(expected) {
        const val = this.int32();
        if (expected !== undefined && val !== expected) {
            throw new Error(`Expecting ${expected}, but get ${val} at position ${this.i - 4}`);
        }
    }
    float64() {
        const val = this.data.readDoubleLE(this.i);
        this.i += 8;
        return val;
    }
    seek(n) {
        this.i += n;
    }
    isNotEnd() {
        if (this.data.length === this.i) {
            return undefined;
        }
        else {
            return (`Not an end! We are at ` +
                `0x${Number(this.i).toString(16)}, file len=0x${Number(this.data.length).toString(16)} ` +
                ` left=0x${Number(this.data.length - this.i).toString(16)}`);
        }
    }
    debugShowHex(n = 300) {
        console.info("Data at 0x" + Number(this.i).toString(16) + "\n");
        let s = "";
        for (let i = 0; i < n; i++) {
            s = s + ("0" + Number(this.data[this.i + i]).toString(16)).slice(-2) + ":";
            if (i % 16 === 15) {
                s = s + "\n";
            }
        }
        console.info(s);
    }
}
exports.Reader = Reader;
var PlayerRace;
(function (PlayerRace) {
    PlayerRace[PlayerRace["\u041C\u0430\u043B\u043E\u043A\u0438"] = 1] = "\u041C\u0430\u043B\u043E\u043A\u0438";
    PlayerRace[PlayerRace["\u041F\u0435\u043B\u0435\u043D\u0433\u0438"] = 2] = "\u041F\u0435\u043B\u0435\u043D\u0433\u0438";
    PlayerRace[PlayerRace["\u041B\u044E\u0434\u0438"] = 4] = "\u041B\u044E\u0434\u0438";
    PlayerRace[PlayerRace["\u0424\u0435\u044F\u043D\u0435"] = 8] = "\u0424\u0435\u044F\u043D\u0435";
    PlayerRace[PlayerRace["\u0413\u0430\u0430\u043B\u044C\u0446\u044B"] = 16] = "\u0413\u0430\u0430\u043B\u044C\u0446\u044B";
})(PlayerRace || (PlayerRace = {}));
var PlanetRace;
(function (PlanetRace) {
    PlanetRace[PlanetRace["\u041C\u0430\u043B\u043E\u043A\u0438"] = 1] = "\u041C\u0430\u043B\u043E\u043A\u0438";
    PlanetRace[PlanetRace["\u041F\u0435\u043B\u0435\u043D\u0433\u0438"] = 2] = "\u041F\u0435\u043B\u0435\u043D\u0433\u0438";
    PlanetRace[PlanetRace["\u041B\u044E\u0434\u0438"] = 4] = "\u041B\u044E\u0434\u0438";
    PlanetRace[PlanetRace["\u0424\u0435\u044F\u043D\u0435"] = 8] = "\u0424\u0435\u044F\u043D\u0435";
    PlanetRace[PlanetRace["\u0413\u0430\u0430\u043B\u044C\u0446\u044B"] = 16] = "\u0413\u0430\u0430\u043B\u044C\u0446\u044B";
    PlanetRace[PlanetRace["\u041D\u0435\u0437\u0430\u0441\u0435\u043B\u0435\u043D\u043D\u0430\u044F"] = 64] = "\u041D\u0435\u0437\u0430\u0441\u0435\u043B\u0435\u043D\u043D\u0430\u044F";
})(PlanetRace || (PlanetRace = {}));
var WhenDone;
(function (WhenDone) {
    WhenDone[WhenDone["OnReturn"] = 0] = "OnReturn";
    WhenDone[WhenDone["OnFinish"] = 1] = "OnFinish";
})(WhenDone = exports.WhenDone || (exports.WhenDone = {}));
var PlayerCareer;
(function (PlayerCareer) {
    PlayerCareer[PlayerCareer["\u0422\u043E\u0440\u0433\u043E\u0432\u0435\u0446"] = 1] = "\u0422\u043E\u0440\u0433\u043E\u0432\u0435\u0446";
    PlayerCareer[PlayerCareer["\u041F\u0438\u0440\u0430\u0442"] = 2] = "\u041F\u0438\u0440\u0430\u0442";
    PlayerCareer[PlayerCareer["\u0412\u043E\u0438\u043D"] = 4] = "\u0412\u043E\u0438\u043D";
})(PlayerCareer = exports.PlayerCareer || (exports.PlayerCareer = {}));
// Gladiator: ......C8
// Ivan:      ......D0
// FullRing   ......CA
// Jump       00000000
//
exports.HEADER_QM_2 = 0x423a35d2; // 24 parameters
exports.HEADER_QM_3 = 0x423a35d3; // 48 parameters
exports.HEADER_QM_4 = 0x423a35d4; // 96 parameters
exports.HEADER_QMM_6 = 0x423a35d6;
exports.HEADER_QMM_7 = 0x423a35d7;
/**
 *
 * This is a workaround to tell player to keep old TGE behavior if quest is
 * resaved as new version.
 *
 *
 * 0x423a35d7 = 1111111127
 * 0x69f6bd7  = 0111111127
 */
exports.HEADER_QMM_7_WITH_OLD_TGE_BEHAVIOUR = 0x69f6bd7;
function parseBase(r, header) {
    if (header === exports.HEADER_QMM_6 ||
        header === exports.HEADER_QMM_7 ||
        header === exports.HEADER_QMM_7_WITH_OLD_TGE_BEHAVIOUR) {
        const majorVersion = header === exports.HEADER_QMM_7 || header === exports.HEADER_QMM_7_WITH_OLD_TGE_BEHAVIOUR
            ? r.int32()
            : undefined;
        const minorVersion = header === exports.HEADER_QMM_7 || header === exports.HEADER_QMM_7_WITH_OLD_TGE_BEHAVIOUR
            ? r.int32()
            : undefined;
        const changeLogString = header === exports.HEADER_QMM_7 || header === exports.HEADER_QMM_7_WITH_OLD_TGE_BEHAVIOUR
            ? r.readString(true)
            : undefined;
        const givingRace = r.byte();
        const whenDone = r.byte();
        const planetRace = r.byte();
        const playerCareer = r.byte();
        const playerRace = r.byte();
        const reputationChange = r.int32();
        const screenSizeX = r.int32(); // In pixels
        const screenSizeY = r.int32(); // In pixels
        const widthSize = r.int32(); // Grid width, from small to big 1E-16-0F-0A
        const heightSize = r.int32(); // Grid heigth, from small to big 18-12-0C-08
        const defaultJumpCountLimit = r.int32();
        const hardness = r.int32();
        const paramsCount = r.int32();
        return {
            givingRace,
            whenDone,
            planetRace,
            playerCareer,
            playerRace,
            defaultJumpCountLimit,
            hardness,
            paramsCount,
            changeLogString,
            majorVersion,
            minorVersion,
            screenSizeX,
            screenSizeY,
            reputationChange,
            widthSize,
            heightSize,
        };
    }
    else {
        const paramsCount = header === exports.HEADER_QM_3
            ? 48
            : header === exports.HEADER_QM_2
                ? 24
                : header === exports.HEADER_QM_4
                    ? 96
                    : undefined;
        if (!paramsCount) {
            throw new Error(`Unknown header ${header}`);
        }
        r.dwordFlag();
        const givingRace = r.byte();
        const whenDone = r.byte();
        r.dwordFlag();
        const planetRace = r.byte();
        r.dwordFlag();
        const playerCareer = r.byte();
        r.dwordFlag();
        const playerRace = r.byte();
        const reputationChange = r.int32();
        const screenSizeX = r.int32();
        const screenSizeY = r.int32();
        const widthSize = r.int32();
        const heightSize = r.int32();
        r.dwordFlag();
        const defaultJumpCountLimit = r.int32();
        const hardness = r.int32();
        return {
            givingRace,
            whenDone,
            planetRace,
            playerCareer,
            playerRace,
            defaultJumpCountLimit,
            hardness,
            paramsCount,
            reputationChange,
            // TODO
            screenSizeX,
            screenSizeY,
            widthSize,
            heightSize,
        };
    }
}
var ParamType;
(function (ParamType) {
    ParamType[ParamType["\u041E\u0431\u044B\u0447\u043D\u044B\u0439"] = 0] = "\u041E\u0431\u044B\u0447\u043D\u044B\u0439";
    ParamType[ParamType["\u041F\u0440\u043E\u0432\u0430\u043B\u044C\u043D\u044B\u0439"] = 1] = "\u041F\u0440\u043E\u0432\u0430\u043B\u044C\u043D\u044B\u0439";
    ParamType[ParamType["\u0423\u0441\u043F\u0435\u0448\u043D\u044B\u0439"] = 2] = "\u0423\u0441\u043F\u0435\u0448\u043D\u044B\u0439";
    ParamType[ParamType["\u0421\u043C\u0435\u0440\u0442\u0435\u043B\u044C\u043D\u044B\u0439"] = 3] = "\u0421\u043C\u0435\u0440\u0442\u0435\u043B\u044C\u043D\u044B\u0439";
})(ParamType = exports.ParamType || (exports.ParamType = {}));
var ParamCritType;
(function (ParamCritType) {
    ParamCritType[ParamCritType["\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C"] = 0] = "\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C";
    ParamCritType[ParamCritType["\u041C\u0438\u043D\u0438\u043C\u0443\u043C"] = 1] = "\u041C\u0438\u043D\u0438\u043C\u0443\u043C";
})(ParamCritType = exports.ParamCritType || (exports.ParamCritType = {}));
function parseParam(r) {
    const min = r.int32();
    const max = r.int32();
    r.int32();
    const type = r.byte();
    r.int32();
    const showWhenZero = !!r.byte();
    const critType = r.byte();
    const active = !!r.byte();
    const showingRangesCount = r.int32();
    const isMoney = !!r.byte();
    const name = r.readString();
    const param = {
        min,
        max,
        type,
        showWhenZero,
        critType,
        active,
        // showingRangesCount,
        isMoney,
        name,
        showingInfo: [],
        starting: "",
        critValueString: "",
        img: undefined,
        sound: undefined,
        track: undefined,
    };
    for (let i = 0; i < showingRangesCount; i++) {
        const from = r.int32();
        const to = r.int32();
        const str = r.readString();
        param.showingInfo.push({
            from,
            to,
            str,
        });
    }
    param.critValueString = r.readString();
    param.starting = r.readString();
    return param;
}
function parseParamQmm(r) {
    const min = r.int32();
    const max = r.int32();
    // console.info(`Param min=${min} max=${max}`)
    const type = r.byte();
    //r.debugShowHex(16);
    const unknown1 = r.byte();
    const unknown2 = r.byte();
    const unknown3 = r.byte();
    if (unknown1 !== 0) {
        console.warn(`Unknown1 is params is not zero`);
    }
    if (unknown2 !== 0) {
        console.warn(`Unknown2 is params is not zero`);
    }
    if (unknown3 !== 0) {
        console.warn(`Unknown3 is params is not zero`);
    }
    const showWhenZero = !!r.byte();
    const critType = r.byte();
    const active = !!r.byte();
    const showingRangesCount = r.int32();
    const isMoney = !!r.byte();
    const name = r.readString();
    const param = {
        min,
        max,
        type,
        showWhenZero,
        critType,
        active,
        // showingRangesCount,
        isMoney,
        name,
        showingInfo: [],
        starting: "",
        critValueString: "",
        img: undefined,
        sound: undefined,
        track: undefined,
    };
    // console.info(`Ranges=${showingRangesCount}`)
    for (let i = 0; i < showingRangesCount; i++) {
        const from = r.int32();
        const to = r.int32();
        const str = r.readString();
        param.showingInfo.push({
            from,
            to,
            str,
        });
    }
    param.critValueString = r.readString();
    param.img = r.readString(true);
    param.sound = r.readString(true);
    param.track = r.readString(true);
    param.starting = r.readString();
    return param;
}
function parseBase2(r, isQmm) {
    const ToStar = r.readString();
    const Parsec = isQmm ? undefined : r.readString(true);
    const Artefact = isQmm ? undefined : r.readString(true);
    const ToPlanet = r.readString();
    const Date = r.readString();
    const Money = r.readString();
    const FromPlanet = r.readString();
    const FromStar = r.readString();
    const Ranger = r.readString();
    const locationsCount = r.int32();
    const jumpsCount = r.int32();
    const successText = r.readString();
    const taskText = r.readString();
    // tslint:disable-next-line:no-dead-store
    const unknownText = isQmm ? undefined : r.readString();
    return {
        strings: {
            ToStar,
            Parsec,
            Artefact,
            ToPlanet,
            Date,
            Money,
            FromPlanet,
            FromStar,
            Ranger,
        },
        locationsCount,
        jumpsCount,
        successText,
        taskText,
    };
}
var ParameterShowingType;
(function (ParameterShowingType) {
    ParameterShowingType[ParameterShowingType["\u041D\u0435\u0422\u0440\u043E\u0433\u0430\u0442\u044C"] = 0] = "\u041D\u0435\u0422\u0440\u043E\u0433\u0430\u0442\u044C";
    ParameterShowingType[ParameterShowingType["\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C"] = 1] = "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C";
    ParameterShowingType[ParameterShowingType["\u0421\u043A\u0440\u044B\u0442\u044C"] = 2] = "\u0421\u043A\u0440\u044B\u0442\u044C";
})(ParameterShowingType = exports.ParameterShowingType || (exports.ParameterShowingType = {}));
var ParameterChangeType;
(function (ParameterChangeType) {
    ParameterChangeType[ParameterChangeType["Value"] = 0] = "Value";
    ParameterChangeType[ParameterChangeType["Summ"] = 1] = "Summ";
    ParameterChangeType[ParameterChangeType["Percentage"] = 2] = "Percentage";
    ParameterChangeType[ParameterChangeType["Formula"] = 3] = "Formula";
})(ParameterChangeType = exports.ParameterChangeType || (exports.ParameterChangeType = {}));
var LocationType;
(function (LocationType) {
    LocationType[LocationType["Ordinary"] = 0] = "Ordinary";
    LocationType[LocationType["Starting"] = 1] = "Starting";
    LocationType[LocationType["Empty"] = 2] = "Empty";
    LocationType[LocationType["Success"] = 3] = "Success";
    LocationType[LocationType["Faily"] = 4] = "Faily";
    LocationType[LocationType["Deadly"] = 5] = "Deadly";
})(LocationType = exports.LocationType || (exports.LocationType = {}));
function parseLocation(r, paramsCount) {
    const dayPassed = !!r.int32();
    const locX = r.int32();
    const locY = r.int32();
    const id = r.int32();
    const isStarting = !!r.byte();
    const isSuccess = !!r.byte();
    const isFaily = !!r.byte();
    const isFailyDeadly = !!r.byte();
    const isEmpty = !!r.byte();
    const paramsChanges = [];
    for (let i = 0; i < paramsCount; i++) {
        r.seek(12);
        const change = r.int32();
        const showingType = r.byte();
        r.seek(4);
        const isChangePercentage = !!r.byte();
        const isChangeValue = !!r.byte();
        const isChangeFormula = !!r.byte();
        const changingFormula = r.readString();
        r.seek(10);
        const critText = r.readString();
        paramsChanges.push({
            change,
            showingType,
            isChangePercentage,
            isChangeValue,
            isChangeFormula,
            changingFormula,
            critText,
            img: undefined,
            track: undefined,
            sound: undefined,
        });
    }
    const texts = [];
    const media = [];
    for (let i = 0; i < exports.LOCATION_TEXTS; i++) {
        texts.push(r.readString());
        media.push({ img: undefined, sound: undefined, track: undefined });
    }
    const isTextByFormula = !!r.byte();
    r.seek(4);
    r.readString();
    r.readString();
    const textSelectFurmula = r.readString();
    return {
        dayPassed,
        id,
        isEmpty,
        isFaily,
        isFailyDeadly,
        isStarting,
        isSuccess,
        paramsChanges,
        texts,
        media,
        isTextByFormula,
        textSelectFormula: textSelectFurmula,
        maxVisits: 0,
        locX,
        locY,
    };
}
function parseLocationQmm(r, paramsCount) {
    const dayPassed = !!r.int32();
    const locX = r.int32(); /* In pixels */
    const locY = r.int32(); /* In pixels */
    const id = r.int32();
    const maxVisits = r.int32();
    const type = r.byte();
    const isStarting = type === LocationType.Starting;
    const isSuccess = type === LocationType.Success;
    const isFaily = type === LocationType.Faily;
    const isFailyDeadly = type === LocationType.Deadly;
    const isEmpty = type === LocationType.Empty;
    const paramsChanges = [];
    for (let i = 0; i < paramsCount; i++) {
        paramsChanges.push({
            change: 0,
            showingType: ParameterShowingType.НеТрогать,
            isChangePercentage: false,
            isChangeValue: false,
            isChangeFormula: false,
            changingFormula: "",
            critText: "",
            img: undefined,
            track: undefined,
            sound: undefined,
        });
    }
    const affectedParamsCount = r.int32();
    for (let i = 0; i < affectedParamsCount; i++) {
        const paramN = r.int32();
        const change = r.int32();
        const showingType = r.byte();
        const changeType = r.byte();
        const isChangePercentage = changeType === ParameterChangeType.Percentage;
        const isChangeValue = changeType === ParameterChangeType.Value;
        const isChangeFormula = changeType === ParameterChangeType.Formula;
        const changingFormula = r.readString();
        const critText = r.readString();
        const img = r.readString(true);
        const sound = r.readString(true);
        const track = r.readString(true);
        paramsChanges[paramN - 1] = {
            change,
            showingType,
            isChangePercentage,
            isChangeFormula,
            isChangeValue,
            changingFormula,
            critText,
            img,
            track,
            sound,
        };
    }
    const texts = [];
    const media = [];
    const locationTexts = r.int32();
    for (let i = 0; i < locationTexts; i++) {
        const text = r.readString();
        texts.push(text);
        const img = r.readString(true);
        const sound = r.readString(true);
        const track = r.readString(true);
        media.push({ img, track, sound });
    }
    const isTextByFormula = !!r.byte();
    const textSelectFurmula = r.readString();
    // console.info(isTextByFormula, textSelectFurmula)
    // r.debugShowHex(0); // must be 3543
    return {
        dayPassed,
        id,
        isEmpty,
        isFaily,
        isFailyDeadly,
        isStarting,
        isSuccess,
        paramsChanges,
        texts,
        media,
        isTextByFormula,
        textSelectFormula: textSelectFurmula,
        maxVisits,
        locX,
        locY,
    };
}
function parseJump(r, paramsCount) {
    const priority = r.float64();
    const dayPassed = !!r.int32();
    const id = r.int32();
    const fromLocationId = r.int32();
    const toLocationId = r.int32();
    r.seek(1);
    const alwaysShow = !!r.byte();
    const jumpingCountLimit = r.int32();
    const showingOrder = r.int32();
    const paramsChanges = [];
    const paramsConditions = [];
    for (let i = 0; i < paramsCount; i++) {
        r.seek(4);
        const mustFrom = r.int32();
        const mustTo = r.int32();
        const change = r.int32();
        const showingType = r.int32();
        r.seek(1);
        const isChangePercentage = !!r.byte();
        const isChangeValue = !!r.byte();
        const isChangeFormula = !!r.byte();
        const changingFormula = r.readString();
        const mustEqualValuesCount = r.int32();
        const mustEqualValuesEqual = !!r.byte();
        const mustEqualValues = [];
        //console.info(`mustEqualValuesCount=${mustEqualValuesCount}`)
        for (let ii = 0; ii < mustEqualValuesCount; ii++) {
            mustEqualValues.push(r.int32());
            //  console.info('pushed');
        }
        //console.info(`eq=${mustEqualValuesNotEqual} values = ${mustEqualValues.join(', ')}`)
        const mustModValuesCount = r.int32();
        //console.info(`mustModValuesCount=${mustModValuesCount}`)
        const mustModValuesMod = !!r.byte();
        const mustModValues = [];
        for (let ii = 0; ii < mustModValuesCount; ii++) {
            mustModValues.push(r.int32());
        }
        const critText = r.readString();
        // console.info(`Param ${i} crit text =${critText}`)
        paramsChanges.push({
            change,
            showingType,
            isChangeFormula,
            isChangePercentage,
            isChangeValue,
            changingFormula,
            critText,
            img: undefined,
            track: undefined,
            sound: undefined,
        });
        paramsConditions.push({
            mustFrom,
            mustTo,
            mustEqualValues,
            mustEqualValuesEqual,
            mustModValues,
            mustModValuesMod,
        });
    }
    const formulaToPass = r.readString();
    const text = r.readString();
    const description = r.readString();
    return {
        priority,
        dayPassed,
        id,
        fromLocationId,
        toLocationId,
        alwaysShow,
        jumpingCountLimit,
        showingOrder,
        paramsChanges,
        paramsConditions,
        formulaToPass,
        text,
        description,
        img: undefined,
        track: undefined,
        sound: undefined,
    };
}
function parseJumpQmm(r, paramsCount, questParams) {
    //r.debugShowHex()
    const priority = r.float64();
    const dayPassed = !!r.int32();
    const id = r.int32();
    const fromLocationId = r.int32();
    const toLocationId = r.int32();
    const alwaysShow = !!r.byte();
    const jumpingCountLimit = r.int32();
    const showingOrder = r.int32();
    const paramsChanges = [];
    const paramsConditions = [];
    for (let i = 0; i < paramsCount; i++) {
        paramsChanges.push({
            change: 0,
            showingType: ParameterShowingType.НеТрогать,
            isChangeFormula: false,
            isChangePercentage: false,
            isChangeValue: false,
            changingFormula: "",
            critText: "",
            img: undefined,
            track: undefined,
            sound: undefined,
        });
        paramsConditions.push({
            mustFrom: questParams[i].min,
            mustTo: questParams[i].max,
            mustEqualValues: [],
            mustEqualValuesEqual: false,
            mustModValues: [],
            mustModValuesMod: false,
        });
    }
    const affectedConditionsParamsCount = r.int32();
    for (let i = 0; i < affectedConditionsParamsCount; i++) {
        const paramId = r.int32();
        const mustFrom = r.int32();
        const mustTo = r.int32();
        const mustEqualValuesCount = r.int32();
        const mustEqualValuesEqual = !!r.byte();
        const mustEqualValues = [];
        //console.info(`mustEqualValuesCount=${mustEqualValuesCount}`)
        for (let ii = 0; ii < mustEqualValuesCount; ii++) {
            mustEqualValues.push(r.int32());
            //  console.info('pushed');
        }
        const mustModValuesCount = r.int32();
        const mustModValuesMod = !!r.byte();
        const mustModValues = [];
        for (let ii = 0; ii < mustModValuesCount; ii++) {
            mustModValues.push(r.int32());
        }
        paramsConditions[paramId - 1] = {
            mustFrom,
            mustTo,
            mustEqualValues,
            mustEqualValuesEqual,
            mustModValues,
            mustModValuesMod,
        };
    }
    const affectedChangeParamsCount = r.int32();
    for (let i = 0; i < affectedChangeParamsCount; i++) {
        const paramId = r.int32();
        const change = r.int32();
        const showingType = r.byte();
        const changingType = r.byte();
        const isChangePercentage = changingType === ParameterChangeType.Percentage;
        const isChangeValue = changingType === ParameterChangeType.Value;
        const isChangeFormula = changingType === ParameterChangeType.Formula;
        const changingFormula = r.readString();
        const critText = r.readString();
        const img = r.readString(true);
        const sound = r.readString(true);
        const track = r.readString(true);
        // console.info(`Param ${i} crit text =${critText}`)
        paramsChanges[paramId - 1] = {
            change,
            showingType,
            isChangeFormula,
            isChangePercentage,
            isChangeValue,
            changingFormula,
            critText,
            img,
            track,
            sound,
        };
    }
    const formulaToPass = r.readString();
    const text = r.readString();
    const description = r.readString();
    const img = r.readString(true);
    const sound = r.readString(true);
    const track = r.readString(true);
    return {
        priority,
        dayPassed,
        id,
        fromLocationId,
        toLocationId,
        alwaysShow,
        jumpingCountLimit,
        showingOrder,
        paramsChanges,
        paramsConditions,
        formulaToPass,
        text,
        description,
        img,
        track,
        sound,
    };
}
function parse(data) {
    const r = new Reader(data);
    const header = r.int32();
    const base = parseBase(r, header);
    const isQmm = header === exports.HEADER_QMM_6 ||
        header === exports.HEADER_QMM_7 ||
        header === exports.HEADER_QMM_7_WITH_OLD_TGE_BEHAVIOUR;
    const params = [];
    for (let i = 0; i < base.paramsCount; i++) {
        params.push(isQmm ? parseParamQmm(r) : parseParam(r));
    }
    const base2 = parseBase2(r, isQmm);
    const locations = [];
    for (let i = 0; i < base2.locationsCount; i++) {
        locations.push(isQmm ? parseLocationQmm(r, base.paramsCount) : parseLocation(r, base.paramsCount));
    }
    const jumps = [];
    for (let i = 0; i < base2.jumpsCount; i++) {
        jumps.push(isQmm ? parseJumpQmm(r, base.paramsCount, params) : parseJump(r, base.paramsCount));
    }
    if (r.isNotEnd()) {
        throw new Error(r.isNotEnd());
    }
    const base3 = {
        header,
    };
    return Object.assign(Object.assign(Object.assign(Object.assign({}, base), base2), base3), { params,
        locations,
        jumps });
}
exports.parse = parse;
//# sourceMappingURL=qmreader.js.map