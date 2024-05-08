import Benchmark from "benchmark";

import { Story } from "./index";

const suite = new Benchmark.Suite();

// add tests
suite
  .add("getTokensRE", function () {
    Story.getTokens("Hallo Welt!");
  })
  .add("getTokens", function () {
    Story.getTokens("Hallo Welt!");
  })
  // add listeners
  // .on("cycle", function (event) {
  //   console.log(String(event.target));
  // })
  .on("complete", function () {
    console.log("Fastest is " + this.filter("fastest").map("name"));
  })
  // run async
  .run({ async: true });
