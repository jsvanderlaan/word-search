package main

import (
	"math/rand"
	"sort"
	"strconv"
	"strings"
	"syscall/js"
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
	// fill words in the grid
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

func isDirDiagonal(dir Dir) bool {
	return (dir[0] == 1 && dir[1] == 1) || (dir[0] == -1 && dir[1] == -1) ||
		(dir[0] == 1 && dir[1] == -1) || (dir[0] == -1 && dir[1] == 1)
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
	newPos := Pos{pos.X, pos.Y, pos.Dir}
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

func isPalindrome(word string) bool {
	for i := 0; i < len(word)/2; i++ {
		if word[i] != word[len(word)-1-i] {
			return false
		}
	}
	return true
}

func validateSolution(width, height int, grid *Grid, solution []Solution) bool {
	for _, s := range solution {
		nextPos := s.Pos
		isPalindrome := isPalindrome(s.Word)

		for {
			nextPos = getNextPos(nextPos, width, height)
			if nextPos.equal(s.Pos) {
				break
			}

			if nextPos.X+(len(s.Word)-1)*nextPos.Dir[0] >= 0 && nextPos.X+len(s.Word)*nextPos.Dir[0] <= width &&
				nextPos.Y+(len(s.Word)-1)*nextPos.Dir[1] >= 0 && nextPos.Y+len(s.Word)*nextPos.Dir[1] <= height {
				wordIsEqual := true
				for i := 0; i < len(s.Word); i++ {
					x := nextPos.X + i*nextPos.Dir[0]
					y := nextPos.Y + i*nextPos.Dir[1]
					if grid.Cells[y][x] != rune(s.Word[i]) {
						wordIsEqual = false
						break
					}
				}
				if wordIsEqual && !(isPalindrome && nextPos.X+(len(s.Word)-1)*nextPos.Dir[0] == s.Pos.X &&
					nextPos.Y+(len(s.Word)-1)*nextPos.Dir[1] == s.Pos.Y) {
					return false
				}
			}
		}
	}

	return true
}

func prepareWords(words []string) []string {
	c := make([]string, len(words))
	copy(c, words)

	for i := range c {
		c[i] = strings.ToUpper(c[i])
		// remove spaces and special characters
		c[i] = strings.Map(func(r rune) rune {
			if r >= 'A' && r <= 'Z' {
				return r
			}
			return -1
		}, c[i])
	}

	// sort words
	sort.Slice(c, func(i, j int) bool {
		return len(c[i]) > len(c[j])
	})

	return c
}

func calculateFitAndScore(grid *Grid, word string, pos Pos) (bool, int) {
	fit := true
	score := 1

	for i := 0; i < len(word); i++ {
		x := pos.X + i*pos.Dir[0]
		y := pos.Y + i*pos.Dir[1]

		// Check if the position is within bounds
		if x < 0 || x >= grid.Width || y < 0 || y >= grid.Height {
			return false, 0
		}

		// Check if the cell is empty or matches the current letter
		if grid.Cells[y][x] != '.' && grid.Cells[y][x] != rune(word[i]) {
			return false, 0
		}

		// Increase score for overlaps
		if grid.Cells[y][x] == rune(word[i]) {
			score += 8 // Overlap bonus
		}
	}

	// Increase score for diagonal directions
	if isDirDiagonal(pos.Dir) {
		score += 2 // Diagonal bonus
	}

	return fit, score
}

func getBestPosition(grid *Grid, word string) (Pos, bool) {
	weightedPositions := []Pos{}
	otherPositions := []Pos{}
	bestScore := 0

	for _, dir := range directions {
		for y := 0; y < grid.Height; y++ {
			for x := 0; x < grid.Width; x++ {
				pos := Pos{X: x, Y: y, Dir: dir}
				fit, score := calculateFitAndScore(grid, word, pos)
				if fit && score > 0 {
					if score > bestScore {
						bestScore = score
					}
					if score > 1 {
						for i := 0; i < score; i++ {
							weightedPositions = append(weightedPositions, pos)
						}
					} else {
						otherPositions = append(otherPositions, pos)
					}
				}
			}
		}
	}

	if len(weightedPositions) == 0 && len(otherPositions) == 0 {
		return Pos{}, false
	}
	if len(weightedPositions) == 0 {
		weightedPositions = otherPositions
	}

	randomPosition := weightedPositions[rand.Intn(len(weightedPositions))]

	return randomPosition, true
}

func generate(input []string, width, height int) (string, []Solution) {
	rand.Seed(time.Now().UnixNano())

	maxTries := 10000
	currTry := 0

	for currTry < maxTries {
		currTry++

		words := prepareWords(input)

		// First word random
		word := words[0]
		pos := Pos{X: rand.Intn(width), Y: rand.Intn(height), Dir: directions[2]}
		for {
			if pos.X+(len(word)-1)*pos.Dir[0] >= 0 && pos.X+len(word)*pos.Dir[0] <= width &&
				pos.Y+(len(word)-1)*pos.Dir[1] >= 0 && pos.Y+len(word)*pos.Dir[1] <= height {
				break
			}
			pos = getNextPos(pos, width, height)
		}

		solution := []Solution{Solution{Word: word, Pos: pos}}
		grid := NewGrid(width, height, solution)

		for i := 1; i < len(words); i++ {
			word := words[i]
			if len(word) > width && len(word) > height {
				return "", nil
			}
			pos, fit := getBestPosition(grid, word)
			if !fit {
				break
			}
			solution = append(solution, Solution{Word: word, Pos: pos})
			grid = NewGrid(width, height, solution)
		}

		if len(solution) < len(words) {
			println("Next try")
			continue
		}

		grid = fillRandom(solution, width, height)

		return grid.String(), solution
	}

	return "", nil

}

func generate2(input []string, width, height int) (string, []Solution) {
	rand.Seed(time.Now().UnixNano())

	words := prepareWords(input)

	maxTries := 100
	maxDepth := 50_000_000
	currTry := 0
	currDepth := 0

	for currTry < maxTries {
		currTry++
		currDepth = 0

		startingPos := map[string]Pos{}
		for i := range words {
			startingPos[words[i]] = Pos{X: rand.Intn(width), Y: rand.Intn(height), Dir: directions[2]}
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

			if pos.equal(startingPos[word]) {
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
				currentWord++
			}

			if currentWord >= len(words) {
				break
			}
		}

		// check if words are diagonal
		// diagonalCount := 0
		// for _, s := range solution {
		// 	if isDirDiagonal(s.Pos.Dir) {
		// 		diagonalCount++
		// 	}
		// }
		// if diagonalCount < len(solution)/5 {
		// 	println("Not enough diagonal words")
		// 	continue
		// }

		grid = fillRandom(solution, width, height)

		if len(solution) < len(words) || grid == nil {
			println("Next try")
			continue
		}

		return grid.String(), solution
	}

	println("No solution found")
	return "", nil
}

func generateJS(this js.Value, p []js.Value) interface{} {
	words := p[0].String()
	width := p[1].Int()
	height := p[2].Int()

	words = strings.ReplaceAll(words, "\n", ",")
	wordsList := strings.Split(words, ",")
	grid, solution := generate(wordsList, width, height)

	if grid == "" || solution == nil {
		return map[string]interface{}{
			"grid":     "",
			"solution": []interface{}{}, // Return an empty array instead of nil,
		}
	}

	// Convert the solution array to a JavaScript-friendly format
	jsSolution := js.Global().Get("Array").New()
	for _, s := range solution {
		jsSolution.Call("push", map[string]interface{}{
			"word": s.Word,
			"position": map[string]interface{}{
				"x": s.Pos.X,
				"y": s.Pos.Y,
				"direction": map[string]interface{}{
					"dx": s.Pos.Dir[0],
					"dy": s.Pos.Dir[1],
				},
			},
		})
	}

	return map[string]interface{}{
		"grid":     grid,
		"solution": jsSolution,
	}
}

func fillRandom(solution []Solution, width, height int) *Grid {
	grid := NewGrid(width, height, solution)
	maxFill := 10
	currFill := 0

	charWeights := map[rune]int{
		'A': 8, 'B': 2, 'C': 3, 'D': 4, 'E': 13, 'F': 2, 'G': 2,
		'H': 6, 'I': 7, 'J': 1, 'K': 1, 'L': 4, 'M': 2, 'N': 7,
		'O': 8, 'P': 2, 'Q': 1, 'R': 6, 'S': 6, 'T': 9, 'U': 3,
		'V': 1, 'W': 2, 'X': 1, 'Y': 2, 'Z': 1,
	}

	for _, s := range solution {
		for i := 0; i < len(s.Word); i++ {
			charWeights[rune(s.Word[i])]++
		}
	}

	// Create a weighted pool of characters
	weightedPool := []rune{}
	for char, weight := range charWeights {
		for i := 0; i < weight; i++ {
			weightedPool = append(weightedPool, char)
		}
	}

	for currFill < maxFill {
		currFill++
		// fill the grid with random letters
		for y := 0; y < height; y++ {
			for x := 0; x < width; x++ {
				if grid.Cells[y][x] == '.' {
					copiedWeightedPool := make([]rune, len(weightedPool))
					copy(copiedWeightedPool, weightedPool)

					maxRandCellTrys := 26
					for i := 0; i < maxRandCellTrys; i++ {
						char := copiedWeightedPool[rand.Intn(len(copiedWeightedPool))]
						grid.Cells[y][x] = char
						if validateSolution(width, height, grid, solution) {
							break
						}
						grid.Cells[y][x] = '.' // reset cell if not valid
						for j := len(copiedWeightedPool) - 1; j >= 0; j-- {
							if copiedWeightedPool[j] == char {
								copiedWeightedPool = append(copiedWeightedPool[:j], copiedWeightedPool[j+1:]...)
							}
						}
					}
				}
			}
		}

		if validateSolution(width, height, grid, solution) {
			return grid
		}

		println("Not a valid solution")

		grid = NewGrid(width, height, solution)
	}
	return nil
}

func main() {
	c := make(chan struct{})
	js.Global().Set("generate", js.FuncOf(generateJS))
	<-c
}
