package main

import (
	"math/rand"
	"sort"
	"strconv"
	"time"
)

type Grid struct {
	Width, Height int
	Cells         [][]rune
}

type Solution struct {
	Word string
	Pos  Pos
}

type Pos struct {
	X, Y int
	Dir  [2]int
}

type Dir = [2]int

var directions = []Dir{
	{0, 1},   // Down
	{1, 0},   // Right
	{1, 1},   // Down-Right
	{-1, 0},  // Left
	{0, -1},  // Up
	{-1, -1}, // Up-Left
	{1, -1},  // Up-Right
	{-1, 1},  // Down-Left
}

func (p1 *Pos) equal(p2 Pos) bool {
	return p1.X == p2.X && p1.Y == p2.Y && dirEqual(p1.Dir, p2.Dir)
}

func dirEqual(d1, d2 Dir) bool {
	return d1[0] == d2[0] && d1[1] == d2[1]
}

func NewGrid(w, h int, solutions []Solution) *Grid {
	g := &Grid{Width: w, Height: h, Cells: make([][]rune, h)}
	for y := range g.Cells {
		g.Cells[y] = make([]rune, w)
		for x := range g.Cells[y] {
			g.Cells[y][x] = '.' // placeholder
		}
	}
	// fill words in the grid\
	for _, s := range solutions {
		for i := 0; i < len(s.Word); i++ {
			x := s.Pos.X + i*s.Pos.Dir[0]
			y := s.Pos.Y + i*s.Pos.Dir[1]
			if x >= 0 && x < w && y >= 0 && y < h {
				g.Cells[y][x] = rune(s.Word[i])
			}
		}
	}
	return g
}

func (s *Solution) String() string {
	return s.Word + " at " + s.Pos.String()
}

func (p *Pos) String() string {
	return "Pos(" + strconv.Itoa(p.X) + ", " + strconv.Itoa(p.Y) + ") with direction " + dirToText(p.Dir)
}

func dirToText(dir Dir) string {
	switch {
	case dir[0] == 0 && dir[1] == 1:
		return "Down"
	case dir[0] == 1 && dir[1] == 0:
		return "Right"
	case dir[0] == 1 && dir[1] == 1:
		return "Down-Right"
	case dir[0] == -1 && dir[1] == 0:
		return "Left"
	case dir[0] == 0 && dir[1] == -1:
		return "Up"
	case dir[0] == -1 && dir[1] == -1:
		return "Up-Left"
	case dir[0] == 1 && dir[1] == -1:
		return "Up-Right"
	case dir[0] == -1 && dir[1] == 1:
		return "Down-Left"
	default:
		return "Unknown"
	}
}

func (g *Grid) String() string {
	var str string
	for y := 0; y < g.Height; y++ {
		for x := 0; x < g.Width; x++ {
			str += string(g.Cells[y][x]) + " "
		}
		str += "\n"
	}
	return str
}

func getNextPos(pos Pos, width, height int) Pos {
	//first try a different direction
	currentDir := pos.Dir
	newPos := pos
	// if current dir is upright
	if currentDir[0] == -1 && currentDir[1] == 1 {
		newPos.Dir = [2]int{0, 1} // Down
		if pos.X == width-1 {
			newPos.X = 0
			if pos.Y == height-1 {
				newPos.Y = 0
			} else {
				newPos.Y = pos.Y + 1
			}
		} else {
			newPos.X = pos.X + 1
			newPos.Y = pos.Y
		}
		return newPos
	}

	newDir := [2]int{0, 0}
	if currentDir[0] == 0 && currentDir[1] == 1 {
		newDir = [2]int{1, 0} // Down
	} else if currentDir[0] == 1 && currentDir[1] == 0 {
		newDir = [2]int{1, 1} // Down-Right
	} else if currentDir[0] == 1 && currentDir[1] == 1 {
		newDir = [2]int{-1, 0} // Left
	} else if currentDir[0] == -1 && currentDir[1] == 0 {
		newDir = [2]int{0, -1} // Up
	} else if currentDir[0] == 0 && currentDir[1] == -1 {
		newDir = [2]int{-1, -1} // Up-Left
	} else if currentDir[0] == -1 && currentDir[1] == -1 {
		newDir = [2]int{1, -1} // Down-Left
	} else if currentDir[0] == 1 && currentDir[1] == -1 {
		newDir = [2]int{-1, 1} // Up-Right
	} else if currentDir[0] == -1 && currentDir[1] == 1 {
		newDir = [2]int{0, 1} // Right
	}
	newPos.Dir = newDir

	return newPos
}

func main() {
	rand.Seed(time.Now().UnixNano())

	width := 7
	height := 7
	var words []string = []string{
		"dier",
		"deer",
		"hallo",
		"logisch",
		"test",
		"abravi",
		"larie",
		"bob",
		"kaasje",
		"slapen",
		"kruidt",
		"eva",
	}

	sort.Slice(words, func(i, j int) bool {
		return len(words[i]) > len(words[j])
	})

	maxTries := 100
	maxDepth := 10_000_000
	currTry := 0
	currDepth := 0

	for currTry < maxTries {
		currTry++
		currDepth = 0

		startingPos := map[string]Pos{}
		for i := range words {
			startingPos[words[i]] = Pos{X: rand.Intn(width), Y: rand.Intn(height), Dir: directions[rand.Intn(len(directions))]}
		}
		currentPos := map[string]Pos{}
		for i := range words {
			currentPos[words[i]] = startingPos[words[i]]
		}

		solution := []Solution{}
		grid := NewGrid(width, height, solution)
		currentWord := 0

		// DFS to place words in the grid
		for {
			currDepth++
			if currDepth > maxDepth {
				break
			}
			word := words[currentWord]
			pos := getNextPos(currentPos[word], width, height)
			currentPos[word] = pos

			// print("\nPlacing: " + word + " at " + pos.String())

			if pos.equal(startingPos[word]) {
				// println("\nBacktracking: " + word + " at " + pos.String())
				if currentWord == 0 {
					break
				}
				currentWord--
				solution = solution[:len(solution)-1]
				grid = NewGrid(width, height, solution)
				startingPos[word] = Pos{X: rand.Intn(width), Y: rand.Intn(height), Dir: directions[rand.Intn(len(directions))]}
				currentPos[word] = startingPos[word]
				continue
			}

			// check if word fits in the grid
			fit := false
			if pos.X+(len(word)-1)*pos.Dir[0] >= 0 && pos.X+len(word)*pos.Dir[0] <= width &&
				pos.Y+(len(word)-1)*pos.Dir[1] >= 0 && pos.Y+len(word)*pos.Dir[1] <= height {
				fit = true
				for i := 0; i < len(word); i++ {
					x := pos.X + i*pos.Dir[0]
					y := pos.Y + i*pos.Dir[1]
					if grid.Cells[y][x] != '.' && grid.Cells[y][x] != rune(word[i]) {
						fit = false
						break
					}
				}
			}

			if fit {
				solution = append(solution, Solution{Word: word, Pos: pos})
				grid = NewGrid(width, height, solution)
				// println(grid.String())
				currentWord++
			}

			if currentWord >= len(words) {
				break
			}
		}

		if len(solution) < len(words) {
			println("Next try")
			continue
		}

		// print the grid
		println("Grid:")
		println(grid.String())

		// print the solution
		println("Solution:")
		for _, s := range solution {
			println(s.String())
		}
		return
	}

	println("No solution found")
}
